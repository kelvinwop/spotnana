import {
  type GuestChatCompletionResponse,
  type GuestChatCompletionRequest,
  normalizeAiSettings,
} from "../../models/chat/chatTypes";
import { AiCompletionError, requestAiCompletion } from "./aiCompletion";
import { registerCompletionRequest, releaseCompletionRequest } from "./completionState";
import { createMessage } from "./shared";

export async function createGuestCompletionHandler(
  context: {
    body: GuestChatCompletionRequest;
    request: Request;
    set: { status?: number | string };
  }
): Promise<GuestChatCompletionResponse | { error: string; message: string; kind?: string }> {
  const { body, request, set } = context;

  const dedup = registerCompletionRequest({
    mode: "guest",
    subjectId: body.guestSessionId,
    prompt: body.prompt,
  });

  if (!dedup.accepted) {
    set.status = 409;
    return {
      error: "Duplicate prompt blocked",
      message: "An identical guest prompt is already being processed. Please wait a moment before retrying.",
      kind: "duplicate_request",
    };
  }

  const requestId = dedup.requestId;

  try {
    const aiSettings = normalizeAiSettings({
      apiKey: body.apiKey,
      providerPreference: body.providerPreference,
      model: body.model,
    });

    if (!aiSettings.apiKey) {
      set.status = 400;
      return {
        error: "Missing API key",
        message: "Add your API key in settings before sending a prompt.",
        kind: "missing_api_key",
      };
    }

    const completion = await requestAiCompletion({
      prompt: body.prompt,
      messages: body.history,
      apiKey: aiSettings.apiKey,
      providerPreference: aiSettings.providerPreference,
      model: aiSettings.model,
      signal: request.signal,
    });

    return {
      mode: "guest",
      message: createMessage("assistant", completion.content),
    };
  } catch (error) {
    if (error instanceof AiCompletionError) {
      set.status = error.status;
      return {
        error: "Failed to create guest completion",
        message: error.message,
        kind: error.kind,
      };
    }

    set.status = 500;
    return {
      error: "Failed to create guest completion",
      message: error instanceof Error ? error.message : "Unknown error",
    };
  } finally {
    releaseCompletionRequest({
      mode: "guest",
      subjectId: body.guestSessionId,
      prompt: body.prompt,
      requestId,
    });
  }
}
