import {
  ConversationModel,
  type IConversationDocument,
  toConversationRecord,
} from "../../models/chat/Conversation";
import {
  type AccountChatCompletionRequest,
  type AiCompletionHistoryMessage,
  type AuthChatInputMessage,
  type ChatConversationResponse,
  normalizeAiSettings,
} from "../../models/chat/chatTypes";
import { UserModel } from "../../models/User";
import { AiCompletionError, requestAiCompletion } from "./aiCompletion";
import {
  parseCanonicalConversationId,
  toAiCompletionHistory,
} from "./conversationBoundary";
import { registerCompletionRequest, releaseCompletionRequest } from "./completionState";
import { createConversationTitle, createMessage } from "./shared";

interface ChatCompletionFailure {
  error: string;
  message: string;
  kind?: string;
}

type AccountConversationTarget =
  | {
      type: "new";
      messages: AuthChatInputMessage[];
    }
  | {
      type: "existing";
      conversation: IConversationDocument;
      messages: AiCompletionHistoryMessage[];
    }
  | {
      type: "invalid";
      status: number;
      response: ChatCompletionFailure;
    };

function toPersistedMessage(message: ReturnType<typeof createMessage>) {
  return {
    id: message.id,
    role: message.role,
    content: message.content,
    createdAt: new Date(message.createdAt),
  };
}

async function resolveConversationTarget(
  request: AccountChatCompletionRequest,
  userId: string
): Promise<AccountConversationTarget> {
  if (!request.conversationId) {
    return {
      type: "new",
      messages: request.history,
    };
  }

  const parsedConversationId = parseCanonicalConversationId(request.conversationId);
  if (parsedConversationId.type === "invalid") {
    return {
      type: "invalid",
      status: 400,
      response: parsedConversationId.error,
    };
  }

  const conversation = await ConversationModel.findOne({
    _id: parsedConversationId.value,
    userId,
  }).exec();

  if (!conversation) {
    return {
      type: "invalid",
      status: 404,
      response: {
        error: "Conversation not found",
        message: "The requested conversation does not exist for this account.",
        kind: "invalid_request",
      },
    };
  }

  return {
    type: "existing",
    conversation,
    messages: toAiCompletionHistory(conversation),
  };
}

interface CreateCompletionContext {
  body: AccountChatCompletionRequest;
  request: Request;
  user: {
    userId: string;
  };
  set: {
    status?: number | string;
  };
}

export async function createCompletionHandler(
  context: CreateCompletionContext
): Promise<ChatConversationResponse | ChatCompletionFailure> {
  const { body, user, set, request } = context;

  const dedup = registerCompletionRequest({
    mode: "account",
    subjectId: user.userId,
    prompt: body.prompt,
  });

  if (!dedup.accepted) {
    set.status = 409;
    return {
      error: "Duplicate prompt blocked",
      message: "An identical prompt is already being processed. Please wait a moment before retrying.",
      kind: "duplicate_request",
    };
  }

  const requestId = dedup.requestId;

  try {
    const foundUser = await UserModel.findById(user.userId).exec();
    if (!foundUser) {
      set.status = 404;
      return {
        error: "User not found",
        message: "Your account could not be loaded.",
      };
    }

    const aiSettings = normalizeAiSettings(foundUser.aiSettings);
    if (!aiSettings.apiKey) {
      set.status = 400;
      return {
        error: "Missing API key",
        message: "Add your API key in settings before sending a prompt.",
        kind: "missing_api_key",
      };
    }

    const conversationTarget = await resolveConversationTarget(body, user.userId);
    if (conversationTarget.type === "invalid") {
      set.status = conversationTarget.status;
      return conversationTarget.response;
    }

    const completion = await requestAiCompletion({
      prompt: body.prompt,
      messages: conversationTarget.messages,
      apiKey: aiSettings.apiKey,
      providerPreference: aiSettings.providerPreference,
      model: aiSettings.model,
      signal: request.signal,
    });

    const userMessage = createMessage("user", body.prompt);
    const assistantMessage = createMessage("assistant", completion.content);

    const conversation =
      conversationTarget.type === "existing"
        ? conversationTarget.conversation
        : await ConversationModel.create({
            userId: user.userId,
            title: createConversationTitle(body.prompt),
            messages: [toPersistedMessage(userMessage), toPersistedMessage(assistantMessage)],
          });

    if (conversationTarget.type === "existing") {
      conversation.messages.push(
        toPersistedMessage(userMessage),
        toPersistedMessage(assistantMessage)
      );
      await conversation.save();
    }

    return {
      mode: "account",
      conversation: toConversationRecord(conversation),
    };
  } catch (error) {
    if (error instanceof AiCompletionError) {
      set.status = error.status;
      return {
        error: "Failed to create completion",
        message: error.message,
        kind: error.kind,
      };
    }

    set.status = 500;
    return {
      error: "Failed to create completion",
      message: error instanceof Error ? error.message : "Unknown error",
    };
  } finally {
    releaseCompletionRequest({
      mode: "account",
      subjectId: user.userId,
      prompt: body.prompt,
      requestId,
    });
  }
}
