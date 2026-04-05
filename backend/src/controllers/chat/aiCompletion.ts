import {
  type AiCompletionHistoryMessage,
  type AiProvider,
  type AiProviderPreference,
  getDefaultModelForProvider,
  resolveAiProvider,
  trimApiKey,
  trimModel,
} from "../../models/chat/chatTypes";

export interface AiCompletionRequest {
  prompt: string;
  messages: AiCompletionHistoryMessage[];
  apiKey: string;
  providerPreference: AiProviderPreference;
  model: string;
  signal: AbortSignal;
}

export interface AiCompletionResponse {
  content: string;
  provider: AiProvider;
}

export type AiCompletionErrorKind =
  | "missing_api_key"
  | "invalid_api_key"
  | "rate_limited"
  | "server_error"
  | "network_error"
  | "aborted"
  | "invalid_request";

export class AiCompletionError extends Error {
  readonly kind: AiCompletionErrorKind;
  readonly status: number;
  readonly provider?: AiProvider;

  constructor(
    kind: AiCompletionErrorKind,
    message: string,
    status: number,
    provider?: AiProvider
  ) {
    super(message);
    this.name = "AiCompletionError";
    this.kind = kind;
    this.status = status;
    this.provider = provider;
  }
}

interface ProviderConfig {
  readonly provider: AiProvider;
  readonly apiUrl: string;
  readonly defaultModel: string;
  readonly keyPrefixes: readonly string[];
}

const providerConfigs: Record<AiProvider, ProviderConfig> = {
  openai: {
    provider: "openai",
    apiUrl: "https://api.openai.com/v1/chat/completions",
    defaultModel: getDefaultModelForProvider("openai"),
    keyPrefixes: ["sk-", "sk-proj-", "sk-svcacct-"],
  },
  openrouter: {
    provider: "openrouter",
    apiUrl: "https://openrouter.ai/api/v1/chat/completions",
    defaultModel: getDefaultModelForProvider("openrouter"),
    keyPrefixes: ["sk-or-"],
  },
};

interface OpenAiStreamChunkChoiceDelta {
  content?: string;
}

interface OpenAiStreamChunkChoice {
  delta?: OpenAiStreamChunkChoiceDelta;
}

interface OpenAiStreamChunk {
  choices?: OpenAiStreamChunkChoice[];
}

function resolveProviderConfig(provider: AiProvider): ProviderConfig {
  return providerConfigs[provider];
}

function resolveModel(model: string, provider: AiProvider): string {
  const trimmedModel = trimModel(model);
  if (trimmedModel.length > 0) {
    return trimmedModel;
  }

  return providerConfigs[provider].defaultModel;
}

function mapHttpError(
  response: Response,
  fallbackText: string,
  provider: AiProvider
): AiCompletionError {
  if (response.status === 401) {
    return new AiCompletionError(
      "invalid_api_key",
      fallbackText || "The provided API key was rejected by the AI provider.",
      401,
      provider
    );
  }

  if (response.status === 429) {
    return new AiCompletionError(
      "rate_limited",
      fallbackText || "The AI provider rate limited this request.",
      429,
      provider
    );
  }

  if (response.status >= 400 && response.status < 500) {
    return new AiCompletionError(
      "invalid_request",
      fallbackText || `The AI provider rejected the request (${String(response.status)}).`,
      response.status,
      provider
    );
  }

  return new AiCompletionError(
    "server_error",
    fallbackText || `The AI provider failed with status ${String(response.status)}.`,
    response.status,
    provider
  );
}

function parseStructuredErrorText(body: unknown): string | undefined {
  if (typeof body !== "object" || body === null) {
    return undefined;
  }

  const record = body as Record<string, unknown>;
  const directMessage = record["message"];
  if (typeof directMessage === "string" && directMessage.trim().length > 0) {
    return directMessage.trim();
  }

  const nestedError = record["error"];
  if (typeof nestedError === "string" && nestedError.trim().length > 0) {
    return nestedError.trim();
  }

  if (typeof nestedError === "object" && nestedError !== null) {
    const nestedMessage = (nestedError as Record<string, unknown>)["message"];
    if (typeof nestedMessage === "string" && nestedMessage.trim().length > 0) {
      return nestedMessage.trim();
    }
  }

  return undefined;
}

async function readErrorText(response: Response): Promise<string> {
  const responseText = await response.text().catch(() => "");
  if (responseText.trim().length === 0) {
    return "";
  }

  try {
    const parsed = JSON.parse(responseText) as unknown;
    return parseStructuredErrorText(parsed) ?? responseText;
  } catch {
    return responseText;
  }
}

async function readStreamedContent(response: Response): Promise<string> {
  if (!response.body) {
    throw new AiCompletionError("server_error", "The AI provider returned no response body.", 502);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let assistantText = "";

  while (true) {
    const chunk = await reader.read();
    if (chunk.done) {
      break;
    }

    buffer += decoder.decode(chunk.value, { stream: true });
    const parts = buffer.split("\n\n");
    buffer = parts.pop() ?? "";

    for (const part of parts) {
      const lines = part.split("\n");
      for (const line of lines) {
        if (!line.startsWith("data:")) {
          continue;
        }

        const payload = line.slice(5).trim();
        if (payload === "[DONE]") {
          continue;
        }

        let parsedChunk: OpenAiStreamChunk;
        try {
          parsedChunk = JSON.parse(payload) as OpenAiStreamChunk;
        } catch {
          continue;
        }

        const token = parsedChunk.choices?.[0]?.delta?.content;
        if (typeof token === "string") {
          assistantText += token;
        }
      }
    }
  }

  const finalText = assistantText.trim();
  if (finalText.length === 0) {
    throw new AiCompletionError("server_error", "The AI provider returned an empty response.", 502);
  }

  return finalText;
}

export async function requestAiCompletion(
  request: AiCompletionRequest
): Promise<AiCompletionResponse> {
  const trimmedApiKey = trimApiKey(request.apiKey);
  if (trimmedApiKey.length === 0) {
    throw new AiCompletionError("missing_api_key", "An API key is required to send prompts.", 400);
  }

  const resolvedProvider = resolveAiProvider(
    request.providerPreference,
    trimmedApiKey,
    request.model
  );
  const providerConfig = resolveProviderConfig(resolvedProvider);
  const model = resolveModel(request.model, resolvedProvider);

  try {
    const response = await fetch(providerConfig.apiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${trimmedApiKey}`,
        "Content-Type": "application/json",
        ...(providerConfig.provider === "openrouter"
          ? {
              "HTTP-Referer": "https://spotnana-assessment.local",
              "X-Title": "Spotnana Assessment Chat",
            }
          : {}),
      },
      body: JSON.stringify({
        model,
        stream: true,
        messages: [
          {
            role: "system",
            content:
              "You are Spotnana's assessment assistant. Be concise, helpful, and grounded in the user's request.",
          },
          ...request.messages,
          {
            role: "user",
            content: request.prompt,
          },
        ],
      }),
      signal: request.signal,
    });

    if (!response.ok) {
      const fallbackText = await readErrorText(response);
      throw mapHttpError(response, fallbackText, providerConfig.provider);
    }

    return {
      content: await readStreamedContent(response),
      provider: providerConfig.provider,
    };
  } catch (error) {
    if (error instanceof AiCompletionError) {
      throw error;
    }

    if (error instanceof DOMException && error.name === "AbortError") {
      throw new AiCompletionError("aborted", "The request was aborted.", 499, providerConfig.provider);
    }

    if (error instanceof Error) {
      throw new AiCompletionError(
        "network_error",
        error.message || "A network error interrupted the AI request.",
        503,
        providerConfig.provider
      );
    }

    throw new AiCompletionError(
      "server_error",
      "The AI request failed unexpectedly.",
      500,
      providerConfig.provider
    );
  }
}
