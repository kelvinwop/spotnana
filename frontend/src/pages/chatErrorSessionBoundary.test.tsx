import { authStatusAtom, userAtom } from "@/atoms/authAtoms";
import { chatErrorAtom } from "@/atoms/chatAtoms";
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

function renderWithStore(store = createStore()): string {
  return renderToStaticMarkup(
    <Provider store={store}>
      <StaticRenderRouter>
        <ChatPage />
      </StaticRenderRouter>
    </Provider>
  );
}

test("ChatPage hides guest chatError after account mode activates", () => {
  const guestStore = createStore();
  guestStore.set(chatErrorAtom, {
    kind: "network_error",
    title: "Guest request failed",
    message: "Guest mode could not finish the request.",
    prompt: "Guest prompt",
  });

  const guestHtml = renderWithStore(guestStore);
  assert.match(guestHtml, /Guest request failed/);

  const accountStore = createStore();
  accountStore.set(chatErrorAtom, {
    kind: "network_error",
    title: "Guest request failed",
    message: "Guest mode could not finish the request.",
    prompt: "Guest prompt",
  });
  accountStore.set(userAtom, authenticatedUser);
  accountStore.set(authStatusAtom, "ready");

  const accountHtml = renderWithStore(accountStore);
  assert.doesNotMatch(accountHtml, /Guest request failed/);
  assert.doesNotMatch(accountHtml, /Retry/);
});
