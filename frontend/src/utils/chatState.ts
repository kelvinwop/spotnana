import { type AuthChatMessageInput, type ChatMessage, type ConversationRecord, type ConversationSummary } from "@/types/chat";

export function createConversationTitle(prompt: string): string {
  const normalized = prompt.trim().replace(/\s+/g, " ");
  return normalized.length <= 60 ? normalized : `${normalized.slice(0, 57)}...`;
}

export function sortConversationSummaries(
  conversations: ConversationSummary[]
): ConversationSummary[] {
  return [...conversations].sort((left, right) =>
    right.updatedAt.localeCompare(left.updatedAt)
  );
}

export function summarizeConversation(conversation: ConversationRecord): ConversationSummary {
  return {
    id: conversation.id,
    title: conversation.title,
    updatedAt: conversation.updatedAt,
    createdAt: conversation.createdAt,
    messageCount: conversation.messageCount,
    owner: conversation.owner,
  };
}

export function upsertConversationSummary(
  summaries: ConversationSummary[],
  summary: ConversationSummary
): ConversationSummary[] {
  const next = summaries.filter((item) => item.id !== summary.id);
  return sortConversationSummaries([summary, ...next]);
}

export function removeConversationSummary(
  summaries: ConversationSummary[],
  conversationId: string
): ConversationSummary[] {
  return summaries.filter((item) => item.id !== conversationId);
}

export function createMessage(role: ChatMessage["role"], content: string): ChatMessage {
  return {
    id: crypto.randomUUID(),
    role,
    content,
    createdAt: new Date().toISOString(),
  };
}

export function createEmptyConversation(prompt?: string): ConversationRecord {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    title: createConversationTitle(prompt ?? "New conversation"),
    createdAt: now,
    updatedAt: now,
    owner: "guest",
    messageCount: 0,
    messages: [],
  };
}

export function applyConversationMessages(
  conversation: ConversationRecord,
  messages: ChatMessage[]
): ConversationRecord {
  const updatedAt = messages.length > 0 ? messages[messages.length - 1].createdAt : conversation.updatedAt;
  return {
    ...conversation,
    messages,
    messageCount: messages.length,
    updatedAt,
    title:
      conversation.messageCount === 0 && messages[0]?.role === "user"
        ? createConversationTitle(messages[0].content)
        : conversation.title,
  };
}

export function replaceConversationMessage(
  conversation: ConversationRecord,
  messageId: string,
  replacement: ChatMessage
): ConversationRecord {
  return applyConversationMessages(
    conversation,
    conversation.messages.map((message) => (message.id === messageId ? replacement : message))
  );
}

export function buildHistoryForAccount(messages: ChatMessage[]): AuthChatMessageInput[] {
  return messages.flatMap((message) => {
    if (message.role === "user" || message.role === "assistant") {
      return [
        {
          role: message.role,
          content: message.content,
        },
      ];
    }

    return [];
  });
}
