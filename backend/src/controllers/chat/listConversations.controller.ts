import { type AuthContext } from "../../middlewares/auth";
import { ConversationModel, toConversationSummary } from "../../models/chat/Conversation";
import { type ChatConversationListResponse } from "../../models/chat/chatTypes";
import { sortConversationSummaries } from "./shared";

export async function listConversationsHandler(
  context: AuthContext
): Promise<ChatConversationListResponse | { error: string; message: string }> {
  try {
    const conversations = await ConversationModel.find({ userId: context.user.userId })
      .sort({ updatedAt: -1 })
      .exec();

    return {
      mode: "account",
      conversations: sortConversationSummaries(
        conversations.map((conversation) => toConversationSummary(conversation))
      ),
    };
  } catch (error) {
    context.set.status = 500;
    return {
      error: "Failed to load conversations",
      message: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
