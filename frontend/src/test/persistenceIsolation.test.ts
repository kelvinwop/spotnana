import assert from "node:assert/strict";
import { describe, test } from "bun:test";
import { createStore } from "jotai";
import { tokenAtom } from "@/atoms/authAtoms";
import { readBrowserStorageState } from "@/atoms/persistenceAdapter";
import {
  guestAiSettingsAtom,
  guestChatStoreAtom,
  guestSelectedConversationIdAtom,
} from "@/atoms/chatAtoms";
import { type ConversationRecord } from "@/types/chat";

function createGuestConversation(id: string, title: string): ConversationRecord {
  return {
    id,
    title,
    owner: "guest",
    createdAt: "2026-04-05T10:00:00.000Z",
    updatedAt: "2026-04-05T10:00:00.000Z",
    messageCount: 0,
    messages: [],
  };
}

describe("frontend test persistence isolation", () => {
  test("persisted auth and guest chat atoms can populate browser storage within a single test", () => {
    const store = createStore();
    const guestConversation = createGuestConversation("guest-conversation-1", "Guest chat");

    store.set(tokenAtom, "persisted-token");
    store.set(guestChatStoreAtom, {
      conversations: [guestConversation],
    });
    store.set(guestSelectedConversationIdAtom, guestConversation.id);
    store.set(guestAiSettingsAtom, {
      apiKey: "sk-test-guest-key",
      providerPreference: "openai",
      selectedModelPreset: "gpt-4o-mini",
      customModel: "",
    });

    assert.equal(store.get(tokenAtom), "persisted-token");
    assert.deepEqual(store.get(guestChatStoreAtom), {
      conversations: [guestConversation],
    });
    assert.equal(store.get(guestSelectedConversationIdAtom), guestConversation.id);
    assert.equal(store.get(guestAiSettingsAtom).apiKey, "sk-test-guest-key");
    assert.equal(readBrowserStorageState().localStorageItemCount > 0, true);
  });

  test("a later test gets fresh auth and guest chat defaults instead of leaked persisted storage", () => {
    const store = createStore();

    assert.equal(readBrowserStorageState().localStorageItemCount, 0);
    assert.equal(readBrowserStorageState().sessionStorageItemCount, 0);
    assert.equal(store.get(tokenAtom), null);
    assert.deepEqual(store.get(guestChatStoreAtom), {
      conversations: [],
    });
    assert.equal(store.get(guestSelectedConversationIdAtom), null);
    assert.equal(store.get(guestAiSettingsAtom).apiKey, "");
  });
});
