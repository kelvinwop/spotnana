import { authSessionAtom, authStatusAtom, tokenAtom, userAtom } from "@/atoms/authAtoms";
import {
  accountConversationDetailsAtom,
  chatErrorAtom,
  guestAiSettingsAtom,
  guestPendingTurnAtom,
  selectedConversationIdAtom,
} from "@/atoms/chatAtoms";
import { readBrowserStorageState } from "@/atoms/persistenceAdapter";
import { App } from "@/App";
import { withIsolatedBrowserStorage } from "@/test/browserStorageIsolation";
import { type ConversationRecord, type AuthUser } from "@/types/chat";
import { Provider, createStore } from "jotai";
import assert from "node:assert/strict";
import { describe, test } from "bun:test";
import { act } from "react";
import ReactDOM from "react-dom/client";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const authenticatedUser: AuthUser = {
  id: "user-1",
  username: "spotnana-user",
  email: "spotnana@example.com",
  role: "user",
  aiSettings: {
    hasApiKey: true,
    providerPreference: "openai",
    model: "gpt-4o-mini",
  },
};

function createAccountConversation(id: string, title: string): ConversationRecord {
  return {
    id,
    title,
    owner: "account",
    createdAt: "2026-04-05T10:00:00.000Z",
    updatedAt: "2026-04-05T10:00:00.000Z",
    messageCount: 0,
    messages: [],
  };
}

interface Deferred<T> {
  readonly promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
}

function createDeferred<T>(): Deferred<T> {
  let resolvePromise: ((value: T) => void) | null = null;
  let rejectPromise: ((reason?: unknown) => void) | null = null;

  const promise = new Promise<T>((resolve, reject) => {
    resolvePromise = resolve;
    rejectPromise = reject;
  });

  if (resolvePromise === null || rejectPromise === null) {
    throw new Error("Deferred promise did not initialize correctly.");
  }

  return {
    promise,
    resolve: resolvePromise,
    reject: rejectPromise,
  };
}

function waitForMicrotask(): Promise<void> {
  return new Promise((resolve) => {
    queueMicrotask(() => resolve());
  });
}

async function flushEffects(): Promise<void> {
  await waitForMicrotask();
  await waitForMicrotask();
}

function queryButtonByText(container: ParentNode, text: string): HTMLButtonElement {
  const button = Array.from(container.querySelectorAll("button")).find(
    (candidate): candidate is HTMLButtonElement => candidate.textContent?.includes(text) ?? false
  );

  if (!button) {
    throw new Error(`Button containing text "${text}" was not found.`);
  }

  return button;
}

function queryButtonByExactText(container: ParentNode, text: string): HTMLButtonElement {
  const button = Array.from(container.querySelectorAll("button")).find(
    (candidate): candidate is HTMLButtonElement => candidate.textContent?.trim() === text
  );

  if (!button) {
    throw new Error(`Button with exact text "${text}" was not found.`);
  }

  return button;
}

function queryTextarea(container: ParentNode): HTMLTextAreaElement {
  const textarea = container.querySelector("textarea");
  if (!(textarea instanceof HTMLTextAreaElement)) {
    throw new Error("Chat composer textarea was not found.");
  }

  return textarea;
}

async function setTextareaValue(textarea: HTMLTextAreaElement, value: string): Promise<void> {
  await act(async () => {
    const valueSetter = Object.getOwnPropertyDescriptor(
      HTMLTextAreaElement.prototype,
      "value"
    )?.set;

    if (!valueSetter) {
      throw new Error("Textarea value setter was not found.");
    }

    valueSetter.call(textarea, value);
    textarea.dispatchEvent(new window.Event("input", { bubbles: true }));
    await flushEffects();
  });
}

async function clickButton(button: HTMLButtonElement): Promise<void> {
  await act(async () => {
    button.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    await flushEffects();
  });
}

async function settlePromiseWithoutFlushingEffects<T>(promise: Promise<T>): Promise<void> {
  await act(async () => {
    await promise;
  });
}

async function settlePromiseRejectionWithoutFlushingEffects<T>(promise: Promise<T>): Promise<void> {
  await act(async () => {
    await promise.catch(() => undefined);
  });
}

describe("App logout transition boundary", () => {
  test(
    "logout during an in-flight account submit resets submit debounce so immediate guest retry can run",
    withIsolatedBrowserStorage(async () => {
      const browserStorageState = readBrowserStorageState();
      assert.equal(browserStorageState.localStorageItemCount, 0);
      assert.equal(browserStorageState.sessionStorageItemCount, 0);

      const originalFetch = globalThis.fetch;
      const rootElement = document.createElement("div");
      document.body.appendChild(rootElement);
      const root = ReactDOM.createRoot(rootElement);
      const store = createStore();
      const completionRequest = createDeferred<Response>();
      const logoutRequest = createDeferred<Response>();
      const accountConversation = createAccountConversation(
        "account-conversation-1",
        "Account chat"
      );
      const fetchCalls: string[] = [];

      store.set(tokenAtom, "persisted-token");
      store.set(userAtom, authenticatedUser);
      store.set(authStatusAtom, "ready");
      store.set(guestAiSettingsAtom, {
        apiKey: "sk-test-guest-key",
        providerPreference: "openai",
        selectedModelPreset: "gpt-4o-mini",
        customModel: "",
      });

      globalThis.fetch = async (input) => {
        const url =
          typeof input === "string"
            ? input
            : input instanceof URL
              ? input.toString()
              : input.url;
        fetchCalls.push(url);

        if (url.endsWith("/api/v1/chat/conversations")) {
          return new Response(
            JSON.stringify({ mode: "account", conversations: [accountConversation] }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            }
          );
        }

        if (url.endsWith(`/api/v1/chat/conversations/${accountConversation.id}`)) {
          return new Response(
            JSON.stringify({ mode: "account", conversation: accountConversation }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            }
          );
        }

        if (url.endsWith("/api/v1/chat/completions")) {
          return completionRequest.promise;
        }

        if (url.endsWith("/api/v1/auth/logout")) {
          return logoutRequest.promise;
        }

        if (url.endsWith("/api/v1/chat/guest/completions")) {
          return new Response(
            JSON.stringify({
              mode: "guest",
              message: {
                id: "assistant-guest-1",
                role: "assistant",
                content: "Guest retry succeeded.",
                createdAt: "2026-04-05T10:00:01.000Z",
              },
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            }
          );
        }

        throw new Error(`Unexpected fetch: ${url}`);
      };

      try {
        await act(async () => {
          root.render(
            <Provider store={store}>
              <App />
            </Provider>
          );
          await flushEffects();
        });

        const textarea = queryTextarea(rootElement);
        await setTextareaValue(textarea, "Repeat this after logout");

        const sendButton = queryButtonByText(rootElement, "Send");
        await clickButton(sendButton);

        assert.equal(fetchCalls.filter((url) => url.endsWith("/api/v1/chat/completions")).length, 1);
        assert.equal(store.get(authSessionAtom).kind, "account");

        const signOutButton = queryButtonByText(rootElement, "Sign out");
        await clickButton(signOutButton);

        logoutRequest.resolve(
          new Response(JSON.stringify({ message: "Signed out" }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          })
        );

        await settlePromiseWithoutFlushingEffects(logoutRequest.promise);

        assert.equal(store.get(authSessionAtom).kind, "guest");

        const guestTextarea = queryTextarea(rootElement);
        await setTextareaValue(guestTextarea, "Repeat this after logout");

        const guestSendButton = queryButtonByText(rootElement, "Send");
        await clickButton(guestSendButton);

        assert.equal(
          fetchCalls.filter((url) => url.endsWith("/api/v1/chat/guest/completions")).length,
          1
        );
        assert.equal(
          fetchCalls.filter((url) => url.endsWith("/api/v1/chat/completions")).length,
          1
        );
        assert.match(rootElement.textContent ?? "", /Guest retry succeeded\./);
      } finally {
        completionRequest.promise.catch(() => undefined);
        completionRequest.reject(new DOMException("Aborted", "AbortError"));
        await act(async () => {
          root.unmount();
          await flushEffects();
        });
        rootElement.remove();
        globalThis.fetch = originalFetch;
      }
    })
  );

  test(
    "late account failure after logout does not repopulate guest error state in the same store",
    withIsolatedBrowserStorage(async () => {
      const originalFetch = globalThis.fetch;
      const rootElement = document.createElement("div");
      document.body.appendChild(rootElement);
      const root = ReactDOM.createRoot(rootElement);
      const store = createStore();
      const completionRequest = createDeferred<Response>();
      const logoutRequest = createDeferred<Response>();
      const accountConversation = createAccountConversation(
        "account-conversation-1",
        "Account chat"
      );

      store.set(tokenAtom, "persisted-token");
      store.set(userAtom, authenticatedUser);
      store.set(authStatusAtom, "ready");
      store.set(guestAiSettingsAtom, {
        apiKey: "sk-test-guest-key",
        providerPreference: "openai",
        selectedModelPreset: "gpt-4o-mini",
        customModel: "",
      });

      globalThis.fetch = async (input) => {
        const url =
          typeof input === "string"
            ? input
            : input instanceof URL
              ? input.toString()
              : input.url;

        if (url.endsWith("/api/v1/chat/conversations")) {
          return new Response(
            JSON.stringify({ mode: "account", conversations: [accountConversation] }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            }
          );
        }

        if (url.endsWith(`/api/v1/chat/conversations/${accountConversation.id}`)) {
          return new Response(
            JSON.stringify({ mode: "account", conversation: accountConversation }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            }
          );
        }

        if (url.endsWith("/api/v1/chat/completions")) {
          return completionRequest.promise;
        }

        if (url.endsWith("/api/v1/auth/logout")) {
          return logoutRequest.promise;
        }

        throw new Error(`Unexpected fetch: ${url}`);
      };

      try {
        await act(async () => {
          root.render(
            <Provider store={store}>
              <App />
            </Provider>
          );
          await flushEffects();
        });

        await setTextareaValue(queryTextarea(rootElement), "Account failure after logout");
        await clickButton(queryButtonByExactText(rootElement, "Send"));

        assert.equal(store.get(authSessionAtom).kind, "account");
        assert.equal(store.get(chatErrorAtom), null);

        await clickButton(queryButtonByText(rootElement, "Sign out"));
        logoutRequest.resolve(
          new Response(JSON.stringify({ message: "Signed out" }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          })
        );

        await settlePromiseWithoutFlushingEffects(logoutRequest.promise);

        assert.equal(store.get(authSessionAtom).kind, "guest");
        assert.equal(store.get(chatErrorAtom), null);
        assert.equal(store.get(guestPendingTurnAtom), null);

        completionRequest.reject(new Error("Account submit failed after logout"));

        await settlePromiseRejectionWithoutFlushingEffects(completionRequest.promise);

        assert.equal(store.get(authSessionAtom).kind, "guest");
        assert.equal(store.get(chatErrorAtom), null);
        assert.equal(store.get(guestPendingTurnAtom), null);
        assert.doesNotMatch(rootElement.textContent ?? "", /Account submit failed after logout/);
        assert.doesNotMatch(rootElement.textContent ?? "", /Retry/);
      } finally {
        await act(async () => {
          root.unmount();
          await flushEffects();
        });
        rootElement.remove();
        globalThis.fetch = originalFetch;
      }
    })
  );

  test(
    "late account success after logout does not repopulate account conversation state in guest mode",
    withIsolatedBrowserStorage(async () => {
      const originalFetch = globalThis.fetch;
      const rootElement = document.createElement("div");
      document.body.appendChild(rootElement);
      const root = ReactDOM.createRoot(rootElement);
      const store = createStore();
      const completionRequest = createDeferred<Response>();
      const logoutRequest = createDeferred<Response>();
      const accountConversation = createAccountConversation(
        "account-conversation-1",
        "Account chat"
      );
      const completedConversation: ConversationRecord = {
        ...accountConversation,
        title: "Completed after logout",
        updatedAt: "2026-04-05T10:05:00.000Z",
        messageCount: 2,
        messages: [
          {
            id: "user-1",
            role: "user",
            content: "Account success after logout",
            createdAt: "2026-04-05T10:04:00.000Z",
          },
          {
            id: "assistant-1",
            role: "assistant",
            content: "This should not appear in guest mode.",
            createdAt: "2026-04-05T10:05:00.000Z",
          },
        ],
      };

      store.set(tokenAtom, "persisted-token");
      store.set(userAtom, authenticatedUser);
      store.set(authStatusAtom, "ready");
      store.set(guestAiSettingsAtom, {
        apiKey: "sk-test-guest-key",
        providerPreference: "openai",
        selectedModelPreset: "gpt-4o-mini",
        customModel: "",
      });

      globalThis.fetch = async (input) => {
        const url =
          typeof input === "string"
            ? input
            : input instanceof URL
              ? input.toString()
              : input.url;

        if (url.endsWith("/api/v1/chat/conversations")) {
          return new Response(
            JSON.stringify({ mode: "account", conversations: [accountConversation] }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            }
          );
        }

        if (url.endsWith(`/api/v1/chat/conversations/${accountConversation.id}`)) {
          return new Response(
            JSON.stringify({ mode: "account", conversation: accountConversation }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            }
          );
        }

        if (url.endsWith("/api/v1/chat/completions")) {
          return completionRequest.promise;
        }

        if (url.endsWith("/api/v1/auth/logout")) {
          return logoutRequest.promise;
        }

        throw new Error(`Unexpected fetch: ${url}`);
      };

      try {
        await act(async () => {
          root.render(
            <Provider store={store}>
              <App />
            </Provider>
          );
          await flushEffects();
        });

        await setTextareaValue(queryTextarea(rootElement), "Account success after logout");
        await clickButton(queryButtonByExactText(rootElement, "Send"));

        assert.equal(store.get(authSessionAtom).kind, "account");

        await clickButton(queryButtonByText(rootElement, "Sign out"));
        logoutRequest.resolve(
          new Response(JSON.stringify({ message: "Signed out" }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          })
        );

        await settlePromiseWithoutFlushingEffects(logoutRequest.promise);

        assert.equal(store.get(authSessionAtom).kind, "guest");
        assert.equal(store.get(selectedConversationIdAtom), null);
        assert.deepEqual(store.get(accountConversationDetailsAtom), {});

        completionRequest.resolve(
          new Response(JSON.stringify({ mode: "account", conversation: completedConversation }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          })
        );

        await settlePromiseWithoutFlushingEffects(completionRequest.promise);

        assert.equal(store.get(authSessionAtom).kind, "guest");
        assert.equal(store.get(selectedConversationIdAtom), null);
        assert.deepEqual(store.get(accountConversationDetailsAtom), {});
        assert.equal(store.get(chatErrorAtom), null);
        assert.doesNotMatch(rootElement.textContent ?? "", /Completed after logout/);
        assert.doesNotMatch(rootElement.textContent ?? "", /This should not appear in guest mode\./);
      } finally {
        await act(async () => {
          root.unmount();
          await flushEffects();
        });
        rootElement.remove();
        globalThis.fetch = originalFetch;
      }
    })
  );

  test(
    "late account list failure after logout does not repopulate guest error state before effects settle",
    withIsolatedBrowserStorage(async () => {
      const originalFetch = globalThis.fetch;
      const rootElement = document.createElement("div");
      document.body.appendChild(rootElement);
      const root = ReactDOM.createRoot(rootElement);
      const store = createStore();
      const listRequest = createDeferred<Response>();
      const logoutRequest = createDeferred<Response>();

      store.set(tokenAtom, "persisted-token");
      store.set(userAtom, authenticatedUser);
      store.set(authStatusAtom, "ready");

      globalThis.fetch = async (input) => {
        const url =
          typeof input === "string"
            ? input
            : input instanceof URL
              ? input.toString()
              : input.url;

        if (url.endsWith("/api/v1/chat/conversations")) {
          return listRequest.promise;
        }

        if (url.endsWith("/api/v1/auth/logout")) {
          return logoutRequest.promise;
        }

        throw new Error(`Unexpected fetch: ${url}`);
      };

      try {
        await act(async () => {
          root.render(
            <Provider store={store}>
              <App />
            </Provider>
          );
          await flushEffects();
        });

        assert.equal(store.get(authSessionAtom).kind, "account");
        assert.equal(store.get(chatErrorAtom), null);

        await clickButton(queryButtonByText(rootElement, "Sign out"));
        logoutRequest.resolve(
          new Response(JSON.stringify({ message: "Signed out" }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          })
        );

        await settlePromiseWithoutFlushingEffects(logoutRequest.promise);

        assert.equal(store.get(authSessionAtom).kind, "guest");
        assert.equal(store.get(chatErrorAtom), null);

        listRequest.resolve(
          new Response(JSON.stringify({ message: "Server exploded" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          })
        );

        await settlePromiseWithoutFlushingEffects(listRequest.promise);

        assert.equal(store.get(authSessionAtom).kind, "guest");
        assert.equal(store.get(chatErrorAtom), null);
        assert.doesNotMatch(rootElement.textContent ?? "", /Server exploded/);
        assert.doesNotMatch(rootElement.textContent ?? "", /Retry/);
      } finally {
        await act(async () => {
          root.unmount();
          await flushEffects();
        });
        rootElement.remove();
        globalThis.fetch = originalFetch;
      }
    })
  );
});

describe("AI settings session ownership boundary", () => {
  test(
    "late account AI settings save after logout does not restore account state into guest mode",
    withIsolatedBrowserStorage(async () => {
      const originalFetch = globalThis.fetch;
      const originalToast = window.toast;
      const rootElement = document.createElement("div");
      document.body.appendChild(rootElement);
      const root = ReactDOM.createRoot(rootElement);
      const store = createStore();
      const saveSettingsRequest = createDeferred<Response>();
      const logoutRequest = createDeferred<Response>();
      const toastMessages: Array<{ title: string; description?: string }> = [];

      store.set(tokenAtom, "persisted-token");
      store.set(userAtom, authenticatedUser);
      store.set(authStatusAtom, "ready");

      window.toast = (message: { title?: string; description?: string }) => {
        toastMessages.push({
          title: message.title ?? "",
          description: message.description,
        });
      };

      globalThis.fetch = async (input) => {
        const url =
          typeof input === "string"
            ? input
            : input instanceof URL
              ? input.toString()
              : input.url;

        if (url.endsWith("/api/v1/chat/conversations")) {
          return new Response(JSON.stringify({ mode: "account", conversations: [] }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }

        if (url.endsWith("/api/v1/auth/settings/ai")) {
          return saveSettingsRequest.promise;
        }

        if (url.endsWith("/api/v1/auth/logout")) {
          return logoutRequest.promise;
        }

        throw new Error(`Unexpected fetch: ${url}`);
      };

      try {
        await act(async () => {
          root.render(
            <Provider store={store}>
              <App />
            </Provider>
          );
          await flushEffects();
        });

        await clickButton(queryButtonByText(rootElement, "Open AI settings"));
        await clickButton(queryButtonByExactText(rootElement, "Save AI settings"));

        assert.equal(store.get(authSessionAtom).kind, "account");

        await clickButton(queryButtonByText(rootElement, "Sign out"));
        logoutRequest.resolve(
          new Response(JSON.stringify({ message: "Signed out" }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          })
        );

        await settlePromiseWithoutFlushingEffects(logoutRequest.promise);

        assert.equal(store.get(authSessionAtom).kind, "guest");
        assert.equal(store.get(userAtom), null);

        saveSettingsRequest.resolve(
          new Response(
            JSON.stringify({
              user: {
                ...authenticatedUser,
                aiSettings: {
                  hasApiKey: false,
                  providerPreference: "openrouter",
                  model: "openrouter/auto",
                },
              },
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            }
          )
        );

        await settlePromiseWithoutFlushingEffects(saveSettingsRequest.promise);

        assert.equal(store.get(authSessionAtom).kind, "guest");
        assert.equal(store.get(userAtom), null);
        assert.deepEqual(toastMessages.at(-1), {
          title: "Session changed",
          description:
            "Account settings finished saving after your session changed, so the result was ignored.",
        });
        assert.doesNotMatch(rootElement.textContent ?? "", /spotnana-user/);
      } finally {
        await act(async () => {
          root.unmount();
          await flushEffects();
        });
        rootElement.remove();
        globalThis.fetch = originalFetch;
        window.toast = originalToast;
      }
    })
  );
});
