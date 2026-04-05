import { type ChatMessage, type ConversationRecord, type PersistedAiSettings } from "@/types/chat";

interface GuestChatStore {
  readonly conversations: ConversationRecord[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isNullableString(value: unknown): value is string | null {
  return value === null || isString(value);
}

function isAiProviderPreference(value: unknown): value is PersistedAiSettings["providerPreference"] {
  return value === "auto" || value === "openai" || value === "openrouter";
}

function isChatRole(value: unknown): value is ChatMessage["role"] {
  return value === "system" || value === "user" || value === "assistant";
}

function isGuestChatMessage(value: unknown): value is ChatMessage {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isString(value["id"]) &&
    isChatRole(value["role"]) &&
    isString(value["content"]) &&
    isString(value["createdAt"])
  );
}

function isGuestConversationRecord(value: unknown): value is ConversationRecord {
  if (!isRecord(value)) {
    return false;
  }

  const messages = value["messages"];
  if (!Array.isArray(messages) || !messages.every(isGuestChatMessage)) {
    return false;
  }

  return (
    isString(value["id"]) &&
    isString(value["title"]) &&
    isString(value["updatedAt"]) &&
    isString(value["createdAt"]) &&
    typeof value["messageCount"] === "number" &&
    Number.isInteger(value["messageCount"]) &&
    value["messageCount"] === messages.length &&
    value["owner"] === "guest"
  );
}

export function isGuestChatStore(value: unknown): value is GuestChatStore {
  if (!isRecord(value)) {
    return false;
  }

  const conversations = value["conversations"];
  return Array.isArray(conversations) && conversations.every(isGuestConversationRecord);
}

export function isPersistedAiSettings(value: unknown): value is PersistedAiSettings {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isString(value["apiKey"]) &&
    isAiProviderPreference(value["providerPreference"]) &&
    isString(value["selectedModelPreset"]) &&
    isString(value["customModel"])
  );
}

export function isNonEmptyString(value: unknown): value is string {
  return isString(value) && value.length > 0;
}

export { isNullableString };
