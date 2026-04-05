import { Types } from "mongoose";
import {
  type AiCompletionHistoryMessage,
  type ChatRole,
} from "../../models/chat/chatTypes";
import { type IConversationDocument } from "../../models/chat/Conversation";

const canonicalConversationIdPattern = /^[0-9a-f]{24}$/;
const replayablePersistedRoles = new Set<ChatRole>(["system", "user", "assistant"]);

export interface ConversationIdParseSuccess {
  type: "valid";
  value: string;
}

export interface ConversationIdParseFailure {
  type: "invalid";
  error: {
    error: "Invalid conversation target";
    message: "The supplied conversationId is not a valid conversation identifier.";
    kind: "invalid_request";
  };
}

export type ConversationIdParseResult =
  | ConversationIdParseSuccess
  | ConversationIdParseFailure;

export function parseCanonicalConversationId(
  conversationId: string
): ConversationIdParseResult {
  if (!canonicalConversationIdPattern.test(conversationId)) {
    return {
      type: "invalid",
      error: {
        error: "Invalid conversation target",
        message: "The supplied conversationId is not a valid conversation identifier.",
        kind: "invalid_request",
      },
    };
  }

  const canonicalConversationId = new Types.ObjectId(conversationId).toHexString();
  if (canonicalConversationId !== conversationId) {
    return {
      type: "invalid",
      error: {
        error: "Invalid conversation target",
        message: "The supplied conversationId is not a valid conversation identifier.",
        kind: "invalid_request",
      },
    };
  }

  return {
    type: "valid",
    value: canonicalConversationId,
  };
}

export function toAiCompletionHistory(
  conversation: IConversationDocument
): AiCompletionHistoryMessage[] {
  return conversation.messages.map((message) => {
    if (!replayablePersistedRoles.has(message.role)) {
      throw new Error(`Unsupported persisted chat role: ${message.role}`);
    }

    return {
      role: message.role,
      content: message.content,
    };
  });
}
