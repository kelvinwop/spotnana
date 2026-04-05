import { ConversationModel } from "../../models/chat/Conversation";
import { parseCanonicalConversationId } from "./conversationBoundary";

interface ConversationParams {
  id: string;
}

interface DeleteConversationContext {
  params: ConversationParams;
  user: {
    userId: string;
  };
  set: {
    status?: number | string;
  };
}

export async function deleteConversationHandler(
  context: DeleteConversationContext
): Promise<
  | { success: true }
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
    const conversation = await ConversationModel.findOneAndDelete({
      _id: parsedConversationId.value,
      userId: context.user.userId,
    }).exec();

    if (!conversation) {
      context.set.status = 404;
      return { error: "Conversation not found" };
    }

    return { success: true };
  } catch (error) {
    context.set.status = 500;
    return {
      error: "Failed to delete conversation",
      message: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
