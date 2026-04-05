import { authRestoreFailureAtom, authStatusAtom, tokenAtom, userAtom } from "@/atoms/authAtoms";
import { ChatPage } from "@/pages/ChatPage";
import { StaticRenderRouter } from "@/test/renderHarness";
import { type AuthUser } from "@/types/chat";
import { Provider, createStore } from "jotai";
import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

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

function renderWithStore(store = createStore(), ui: JSX.Element): string {
  return renderToStaticMarkup(
    <Provider store={store}>
      <StaticRenderRouter>{ui}</StaticRenderRouter>
    </Provider>
  );
}

function renderAuthenticatedChatPage(): string {
  const store = createStore();
  store.set(userAtom, authenticatedUser);
  store.set(authStatusAtom, "ready");

  return renderWithStore(store, <ChatPage />);
}

test("ChatPage keeps account AI settings out of the main surface", () => {
  const html = renderAuthenticatedChatPage();

  assert.doesNotMatch(html, /Account API key action/);
  assert.doesNotMatch(html, /Keep the current account key as-is/);
  assert.doesNotMatch(html, /Save the typed key to my account/);
  assert.doesNotMatch(html, /Clear the key currently stored on my account/);
  assert.match(html, /Open AI settings/);
  assert.doesNotMatch(html, /Choose your provider, model, and API key\./);
});

test("ChatPage keeps auth and AI settings in separate dialogs for guests", () => {
  const html = renderWithStore(createStore(), <ChatPage />);

  assert.match(html, />Sign in</);
  assert.match(html, /Open AI settings/);
  assert.doesNotMatch(html, /Sign in for synced chat history/);
  assert.doesNotMatch(html, /Workspace settings/);
  assert.doesNotMatch(html, /Session status/);
  assert.doesNotMatch(html, /Auth bootstrap/);
  assert.doesNotMatch(html, /workspace/i);
  assert.doesNotMatch(html, /backend/i);
});

test("ChatPage keeps bootstrap truthful instead of rendering guest actions during session restore", () => {
  const store = createStore();
  store.set(tokenAtom, "persisted-token");

  const html = renderWithStore(store, <ChatPage />);

  assert.match(html, /Restoring account…/);
  assert.match(html, /Restoring your saved chats…/);
  assert.match(html, /Restoring your saved account session…/);
  assert.doesNotMatch(html, />Sign in</);
  assert.doesNotMatch(html, /Guest - Locally saved/);
  assert.doesNotMatch(html, /Configure AI settings to start chatting\./);
  assert.doesNotMatch(html, /Clear guest chats/);
  assert.doesNotMatch(html, /Open AI settings/);
});

test("ChatPage keeps restore failures explicit instead of degrading into guest mode", () => {
  const store = createStore();
  store.set(tokenAtom, "persisted-token");
  store.set(authRestoreFailureAtom, {
    kind: "server_error",
    message: "Auth service is temporarily unavailable.",
  });
  store.set(authStatusAtom, "restore_failed");

  const html = renderWithStore(store, <ChatPage />);

  assert.match(html, /Restore failed/);
  assert.match(html, /Account restore failed/);
  assert.match(html, /Auth service is temporarily unavailable\./);
  assert.match(html, /Account restore needs attention/);
  assert.doesNotMatch(html, />Sign in</);
  assert.doesNotMatch(html, /Guest - Locally saved/);
  assert.doesNotMatch(html, /Configure AI settings to start chatting\./);
  assert.doesNotMatch(html, /Clear guest chats/);
  assert.doesNotMatch(html, /Open AI settings/);
});

test("ChatPage keeps the main surface focused on chat with a compact history rail", () => {
  const html = renderWithStore(createStore(), <ChatPage />);

  assert.match(html, />New chat<\/button>/);
  assert.match(html, /<h2 class="mt-1 text-lg font-semibold">Chats<\/h2>/);
  assert.doesNotMatch(html, /Conversation history/);
  assert.doesNotMatch(html, /Fresh conversation/);
  assert.doesNotMatch(html, /<section[^>]*AI settings/i);
  assert.match(
    html,
    /No conversations yet\. Start with a travel question, policy check, or writing task\./
  );
  assert.match(html, /Configure AI settings to start chatting\./);
  assert.match(html, />Clear<\/button>/);
});
