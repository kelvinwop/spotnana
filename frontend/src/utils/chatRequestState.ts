import { HttpError } from "@/api/http";
import { type ChatFailureKind, type ChatRequestError } from "@/types/chat";

function createError(
  kind: ChatFailureKind,
  title: string,
  message: string,
  status?: number,
  prompt?: string
): ChatRequestError {
  return {
    kind,
    title,
    message,
    status,
    prompt,
  };
}

export function classifyChatRequestError(error: unknown, prompt?: string): ChatRequestError {
  if (error instanceof DOMException && error.name === "AbortError") {
    return createError(
      "aborted",
      "Request cancelled",
      "The previous response was cancelled so a newer prompt could run.",
      undefined,
      prompt
    );
  }

  if (error instanceof HttpError) {
    const kind = (error.kind as ChatFailureKind | undefined) ?? "unknown";

    if (kind === "missing_api_key") {
      return createError(
        kind,
        "Add your API key",
        "Open settings, paste an OpenAI or OpenRouter key, then retry your prompt.",
        error.status,
        prompt
      );
    }

    if (kind === "invalid_api_key") {
      return createError(
        kind,
        "API key rejected",
        "The AI provider rejected this key. Double-check the key or switch providers.",
        error.status,
        prompt
      );
    }

    if (kind === "rate_limited") {
      return createError(
        kind,
        "Rate limit reached",
        "The provider is rate limiting requests right now. Wait a moment and retry.",
        error.status,
        prompt
      );
    }

    if (kind === "duplicate_request") {
      return createError(
        kind,
        "Duplicate prompt blocked",
        "A matching prompt is already running. Wait for it to finish or retry in a moment.",
        error.status,
        prompt
      );
    }

    if (kind === "invalid_request") {
      return createError(
        kind,
        "Request rejected",
        error.message,
        error.status,
        prompt
      );
    }

    if (error.status >= 500) {
      return createError(
        "server_error",
        "Server error",
        error.message || "The AI request failed on the server. Please retry.",
        error.status,
        prompt
      );
    }

    return createError(
      kind,
      "Request failed",
      error.message,
      error.status,
      prompt
    );
  }

  if (error instanceof Error) {
    return createError(
      "network_error",
      "Network error",
      error.message || "A network problem interrupted the request.",
      undefined,
      prompt
    );
  }

  return createError(
    "unknown",
    "Unknown error",
    "The request failed for an unknown reason.",
    undefined,
    prompt
  );
}
