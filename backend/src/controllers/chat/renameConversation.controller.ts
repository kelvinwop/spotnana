import { ConversationModel, toConversationRecord } from "../../models/chat/Conversation";
import { type ChatConversationResponse, type RenameConversationRequest } from "../../models/chat/chatTypes";
import { parseCanonicalConversationId } from "./conversationBoundary";

interface ConversationParams {
  id: string;
}

interface RenameConversationContext {
  params: ConversationParams;
  body: RenameConversationRequest;
  user: {
    userId: string;
  };
  set: {
    status?: number | string;
  };
}

export async function renameConversationHandler(
  context: RenameConversationContext
): Promise<
  | ChatConversationResponse
  | { error: string; message?: string }
  | {
      error: "Invalid conversation target";
      message: "The supplied conversationId is not a valid conversation identifier.";
      kind: "invalid_request";
    }
> {
  const parsedConversationId = parseCanonicalConversationId(context.params.id);
  if (parsedConversationId.type === "invalid") {
    context.set.status = 400;
    return parsedConversationId.error;
  }

  try {
    const conversation = await ConversationModel.findOne({
      _id: parsedConversationId.value,
      userId: context.user.userId,
    }).exec();

    if (!conversation) {
      context.set.status = 404;
      return { error: "Conversation not found" };
    }

    conversation.title = context.body.title.trim();
    await conversation.save();

    return {
      mode: "account",
      conversation: toConversationRecord(conversation),
    };
  } catch (error) {
    context.set.status = 500;
    return {
      error: "Failed to rename conversation",
      message: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
