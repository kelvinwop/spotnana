import { randomUUID } from "crypto";
import { type ChatConversationSummary, type ChatMessageRecord } from "../../models/chat/chatTypes";

export function trimPrompt(prompt: string): string {
  return prompt.trim();
}

export function createConversationTitle(prompt: string): string {
  const normalized = trimPrompt(prompt).replace(/\s+/g, " ");
  return normalized.length <= 60 ? normalized : `${normalized.slice(0, 57)}...`;
}

export function createMessage(role: ChatMessageRecord["role"], content: string): ChatMessageRecord {
  return {
    id: randomUUID(),
    role,
    content,
    createdAt: new Date().toISOString(),
  };
}

export function sortConversationSummaries(
  conversations: ChatConversationSummary[]
): ChatConversationSummary[] {
  return [...conversations].sort((left, right) =>
    right.updatedAt.localeCompare(left.updatedAt)
  );
}
