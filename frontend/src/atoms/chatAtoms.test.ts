import assert from "node:assert/strict";
import { describe, test } from "bun:test";
import { createStore } from "jotai";
import { authStatusAtom, tokenAtom, userAtom } from "@/atoms/authAtoms";
import {
  accountConversationDetailsAtom,
  accountConversationSummariesAtom,
  accountSelectedConversationIdAtom,
  activeConversationAtom,
  chatErrorAtom,
  chatStatusAtom,
  clearAccountConversationStateAtom,
  clearTransientChatStateAtom,
  conversationDetailStatusAtom,
  conversationListStatusAtom,
  createGuestConversationAtom,
  ensureGuestConversationAtom,
  guestChatStoreAtom,
  guestPendingTurnAtom,
  guestSelectedConversationIdAtom,
  isComposingNewConversationAtom,
  replaceAccountConversationAtom,
  selectedConversationIdAtom,
  syncChatSessionScopeAtom,
} from "@/atoms/chatAtoms";
import { type AuthUser, type ConversationRecord, type GuestPendingTurn } from "@/types/chat";

function readGuestConversationIds(store: ReturnType<typeof createStore>): string[] {
  return store.get(guestChatStoreAtom).conversations.map((conversation) => conversation.id);
}

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

function createGuestPendingTurn(conversationId: string): GuestPendingTurn {
  return {
    requestId: "request-1",
    prompt: "Plan the next trip",
    conversationId,
    userMessageId: "message-1",
    baseMessages: [],
  };
}

describe("chatAtoms guest conversation lifecycle", () => {
  test("ensureGuestConversationAtom reuses the selected guest conversation", () => {
    const store = createStore();

    const initialConversation = store.set(ensureGuestConversationAtom);
    const repeatedConversation = store.set(ensureGuestConversationAtom);

    assert.equal(repeatedConversation.id, initialConversation.id);
    assert.equal(store.get(selectedConversationIdAtom), initialConversation.id);
    assert.deepEqual(readGuestConversationIds(store), [initialConversation.id]);
  });

  test("ensureGuestConversationAtom returns the created conversation record for first guest submit flows", () => {
    const store = createStore();

    const createdConversation = store.set(ensureGuestConversationAtom, "First prompt");

    assert.equal(store.get(selectedConversationIdAtom), createdConversation.id);
    assert.equal(store.get(guestChatStoreAtom).conversations.length, 1);
    assert.equal(store.get(guestChatStoreAtom).conversations[0]?.id, createdConversation.id);
    assert.equal(createdConversation.title, "First prompt");
  });

  test("createGuestConversationAtom always creates a fresh selected conversation", () => {
    const store = createStore();

    const firstConversationId = store.set(createGuestConversationAtom, "First prompt");
    const secondConversationId = store.set(createGuestConversationAtom, "Second prompt");

    assert.notEqual(secondConversationId, firstConversationId);
    assert.equal(store.get(selectedConversationIdAtom), secondConversationId);
    assert.deepEqual(readGuestConversationIds(store), [secondConversationId, firstConversationId]);
  });

  test("selectedConversationIdAtom keeps guest and account selections partitioned by auth session", () => {
    const store = createStore();
    const guestConversationId = store.set(createGuestConversationAtom, "Guest prompt");
    const accountConversation = createAccountConversation("account-conversation-1", "Account chat");

    store.set(replaceAccountConversationAtom, accountConversation);
    store.set(tokenAtom, "persisted-token");

    assert.equal(store.get(selectedConversationIdAtom), null);
    assert.equal(store.get(guestSelectedConversationIdAtom), guestConversationId);
    assert.equal(store.get(accountSelectedConversationIdAtom), null);
    assert.equal(store.get(activeConversationAtom), null);

    store.set(userAtom, authenticatedUser);
    store.set(authStatusAtom, "ready");
    store.set(replaceAccountConversationAtom, accountConversation);
    store.set(selectedConversationIdAtom, accountConversation.id);

    assert.equal(store.get(selectedConversationIdAtom), accountConversation.id);
    assert.equal(store.get(accountSelectedConversationIdAtom), accountConversation.id);
    assert.equal(store.get(activeConversationAtom)?.id, accountConversation.id);

    store.set(userAtom, null);
    store.set(tokenAtom, null);
    store.set(authStatusAtom, "ready");

    assert.equal(store.get(selectedConversationIdAtom), guestConversationId);
    assert.equal(store.get(guestSelectedConversationIdAtom), guestConversationId);
    assert.equal(store.get(activeConversationAtom)?.id, guestConversationId);
  });

  test("guest mode rejects account-scoped selection ids after logout", () => {
    const store = createStore();
    const guestConversationId = store.set(createGuestConversationAtom, "Guest prompt");
    const accountConversation = createAccountConversation("account-conversation-1", "Account chat");

    store.set(userAtom, authenticatedUser);
    store.set(authStatusAtom, "ready");
    store.set(replaceAccountConversationAtom, accountConversation);
    store.set(selectedConversationIdAtom, accountConversation.id);

    assert.equal(store.get(selectedConversationIdAtom), accountConversation.id);

    store.set(userAtom, null);
    store.set(tokenAtom, null);
    store.set(authStatusAtom, "ready");
    store.set(selectedConversationIdAtom, accountConversation.id);

    assert.equal(store.get(selectedConversationIdAtom), guestConversationId);
    assert.equal(store.get(guestSelectedConversationIdAtom), guestConversationId);
  });

  test("activeConversationAtom never resolves a guest selection from account details", () => {
    const store = createStore();
    const guestConversationId = store.set(createGuestConversationAtom, "Guest prompt");
    const accountConversation = createAccountConversation(
      guestConversationId,
      "Server chat with same id"
    );

    store.set(accountConversationDetailsAtom, {
      [accountConversation.id]: accountConversation,
    });

    assert.equal(store.get(activeConversationAtom)?.owner, "guest");

    store.set(userAtom, authenticatedUser);
    store.set(authStatusAtom, "ready");
    store.set(replaceAccountConversationAtom, accountConversation);
    store.set(accountSelectedConversationIdAtom, accountConversation.id);

    assert.equal(store.get(activeConversationAtom)?.owner, "account");
  });

  test("replaceAccountConversationAtom refuses to repopulate account state after logout", () => {
    const store = createStore();
    const accountConversation = createAccountConversation("account-conversation-1", "Account chat");

    store.set(userAtom, authenticatedUser);
    store.set(authStatusAtom, "ready");
    store.set(replaceAccountConversationAtom, accountConversation);

    assert.equal(store.get(accountConversationSummariesAtom).length, 1);

    store.set(userAtom, null);
    store.set(tokenAtom, null);
    store.set(authStatusAtom, "ready");
    store.set(clearTransientChatStateAtom);
    store.set(clearAccountConversationStateAtom);
    store.set(replaceAccountConversationAtom, accountConversation);

    assert.deepEqual(store.get(accountConversationSummariesAtom), []);
    assert.deepEqual(store.get(accountConversationDetailsAtom), {});
    assert.equal(store.get(accountSelectedConversationIdAtom), null);
  });

  test("syncChatSessionScopeAtom restores the correct selection for the active auth session", () => {
    const store = createStore();
    const guestConversationId = store.set(createGuestConversationAtom, "Guest prompt");
    const accountConversation = createAccountConversation("account-conversation-1", "Account chat");

    store.set(userAtom, authenticatedUser);
    store.set(authStatusAtom, "ready");
    store.set(replaceAccountConversationAtom, accountConversation);
    store.set(selectedConversationIdAtom, accountConversation.id);

    store.set(userAtom, null);
    store.set(tokenAtom, null);
    store.set(authStatusAtom, "ready");
    store.set(syncChatSessionScopeAtom);

    assert.equal(store.get(selectedConversationIdAtom), guestConversationId);
    assert.equal(store.get(guestSelectedConversationIdAtom), guestConversationId);
    assert.equal(store.get(accountConversationSummariesAtom).length, 0);
    assert.deepEqual(store.get(accountConversationDetailsAtom), {});
    assert.equal(store.get(conversationListStatusAtom), "ready");
    assert.equal(store.get(conversationDetailStatusAtom), "ready");
  });

  test("syncChatSessionScopeAtom hides a guest-scoped chatError after account mode activates", () => {
    const store = createStore();

    store.set(chatErrorAtom, {
      kind: "network_error",
      title: "Guest request failed",
      message: "Guest mode could not finish the request.",
      prompt: "Guest prompt",
    });
    store.set(syncChatSessionScopeAtom);

    const accountConversation = createAccountConversation("account-conversation-1", "Account chat");
    store.set(userAtom, authenticatedUser);
    store.set(authStatusAtom, "ready");
    store.set(replaceAccountConversationAtom, accountConversation);
    store.set(syncChatSessionScopeAtom);

    assert.equal(store.get(chatErrorAtom), null);
  });

  test("syncChatSessionScopeAtom clears visible account chatError when switching back to guest", () => {
    const store = createStore();
    const guestConversationId = store.set(createGuestConversationAtom, "Guest prompt");
    const accountConversation = createAccountConversation("account-conversation-1", "Account chat");

    store.set(userAtom, authenticatedUser);
    store.set(authStatusAtom, "ready");
    store.set(replaceAccountConversationAtom, accountConversation);
    store.set(syncChatSessionScopeAtom);
    store.set(chatErrorAtom, {
      kind: "server_error",
      title: "Account request failed",
      message: "Account mode could not finish the request.",
      prompt: "Account prompt",
      status: 500,
    });

    assert.equal(store.get(chatErrorAtom)?.title, "Account request failed");

    store.set(userAtom, null);
    store.set(tokenAtom, null);
    store.set(authStatusAtom, "ready");
    store.set(syncChatSessionScopeAtom);

    assert.equal(store.get(selectedConversationIdAtom), guestConversationId);
    assert.equal(store.get(chatErrorAtom), null);
  });

  test("syncChatSessionScopeAtom selects the first account conversation when account mode activates", () => {
    const store = createStore();
    const accountConversation = createAccountConversation("account-conversation-1", "Account chat");

    store.set(userAtom, authenticatedUser);
    store.set(authStatusAtom, "ready");
    store.set(replaceAccountConversationAtom, accountConversation);
    store.set(accountSelectedConversationIdAtom, null);
    store.set(isComposingNewConversationAtom, false);
    store.set(syncChatSessionScopeAtom);

    assert.equal(store.get(selectedConversationIdAtom), accountConversation.id);
    assert.equal(store.get(accountSelectedConversationIdAtom), accountConversation.id);
  });

  test("clearTransientChatStateAtom clears submit status and pending turn for guest isolation", () => {
    const store = createStore();
    const guestConversationId = store.set(createGuestConversationAtom, "Guest prompt");

    store.set(chatStatusAtom, "waiting_for_first_token");
    store.set(chatErrorAtom, {
      kind: "duplicate_request",
      title: "Duplicate prompt blocked",
      message: "Prompt already running",
      prompt: "Guest prompt",
    });
    store.set(guestPendingTurnAtom, createGuestPendingTurn(guestConversationId));

    store.set(clearTransientChatStateAtom);

    assert.equal(store.get(chatStatusAtom), "idle");
    assert.equal(store.get(chatErrorAtom), null);
    assert.equal(store.get(guestPendingTurnAtom), null);
  });
});
