import { t } from "elysia";

export const chatRoleValues = ["system", "user", "assistant"] as const;
export type ChatRole = (typeof chatRoleValues)[number];

export const aiProviderValues = ["openai", "openrouter"] as const;
export type AiProvider = (typeof aiProviderValues)[number];
export type AiProviderPreference = AiProvider | "auto";

export interface ChatMessageRecord {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: string;
}

export interface ChatConversationSummary {
  id: string;
  title: string;
  updatedAt: string;
  createdAt: string;
  messageCount: number;
  owner: "guest" | "account";
}

export interface ChatConversationRecord extends ChatConversationSummary {
  messages: ChatMessageRecord[];
}

export interface ChatConversationListResponse {
  mode: "guest" | "account";
  conversations: ChatConversationSummary[];
}

export interface ChatConversationResponse {
  mode: "guest" | "account";
  conversation: ChatConversationRecord;
}

export interface AiCompletionHistoryMessage {
  role: ChatRole;
  content: string;
}

export interface AuthChatInputMessage {
  role: Extract<ChatRole, "user" | "assistant">;
  content: string;
}

export interface AccountChatCompletionRequest {
  conversationId?: string;
  prompt: string;
  history: AuthChatInputMessage[];
}

export interface GuestChatCompletionRequest {
  guestSessionId: string;
  prompt: string;
  history: AuthChatInputMessage[];
  apiKey: string;
  providerPreference: AiProviderPreference;
  model: string;
}

export interface GuestChatCompletionResponse {
  mode: "guest";
  message: ChatMessageRecord;
}

export interface StoredUserAiSettings {
  apiKey?: string;
  providerPreference: AiProviderPreference;
  model: string;
}

export interface PublicUserAiSettings {
  hasApiKey: boolean;
  providerPreference: AiProviderPreference;
  model: string;
}

export type ApiKeyChangeRequest =
  | { type: "keep" }
  | { type: "set"; value: string }
  | { type: "clear" };

export interface UpdateAccountAiSettingsRequest {
  providerPreference: AiProviderPreference;
  model: string;
  apiKeyChange: ApiKeyChangeRequest;
}

export interface RenameConversationRequest {
  title: string;
}

export const authChatMessageSchema = t.Object({
  role: t.Union([t.Literal("user"), t.Literal("assistant")]),
  content: t.String({ minLength: 1, maxLength: 12000 }),
});

export const accountChatCompletionRequestSchema = t.Object({
  conversationId: t.Optional(t.String({ minLength: 1 })),
  prompt: t.String({ minLength: 1, maxLength: 12000 }),
  history: t.Array(authChatMessageSchema, { maxItems: 100 }),
});

export const aiProviderPreferenceSchema = t.Union([
  t.Literal("auto"),
  t.Literal("openai"),
  t.Literal("openrouter"),
]);

export const guestChatCompletionRequestSchema = t.Object({
  guestSessionId: t.String({ minLength: 1, maxLength: 200 }),
  prompt: t.String({ minLength: 1, maxLength: 12000 }),
  history: t.Array(authChatMessageSchema, { maxItems: 100 }),
  apiKey: t.String({ minLength: 1, maxLength: 500 }),
  providerPreference: aiProviderPreferenceSchema,
  model: t.String({ minLength: 1, maxLength: 200 }),
});

export const apiKeyChangeSchema = t.Union([
  t.Object({ type: t.Literal("keep") }),
  t.Object({ type: t.Literal("clear") }),
  t.Object({
    type: t.Literal("set"),
    value: t.String({ minLength: 1, maxLength: 500 }),
  }),
]);

export const updateAccountAiSettingsSchema = t.Object({
  providerPreference: aiProviderPreferenceSchema,
  model: t.String({ minLength: 1, maxLength: 200 }),
  apiKeyChange: apiKeyChangeSchema,
});

export const renameConversationSchema = t.Object({
  title: t.String({ minLength: 1, maxLength: 120 }),
});

export const DEFAULT_OPENAI_MODEL = "gpt-4o-mini";
export const DEFAULT_OPENROUTER_MODEL = "anthropic/claude-sonnet-4-20250514";

export interface NormalizedAiSettings {
  providerPreference: AiProviderPreference;
  resolvedProvider: AiProvider;
  model: string;
  apiKey?: string;
}

export function trimModel(model: string): string {
  return model.trim();
}

export function trimApiKey(apiKey: string): string {
  return apiKey.trim();
}

export function getDefaultModelForProvider(provider: AiProvider): string {
  return provider === "openrouter" ? DEFAULT_OPENROUTER_MODEL : DEFAULT_OPENAI_MODEL;
}

export function getDefaultModelForProviderPreference(
  providerPreference: AiProviderPreference
): string {
  return providerPreference === "openrouter"
    ? getDefaultModelForProvider("openrouter")
    : getDefaultModelForProvider("openai");
}

export function detectProviderFromApiKey(apiKey: string): AiProvider | null {
  const trimmedApiKey = trimApiKey(apiKey);
  if (trimmedApiKey.startsWith("sk-or-")) {
    return "openrouter";
  }
  if (
    trimmedApiKey.startsWith("sk-") ||
    trimmedApiKey.startsWith("sk-proj-") ||
    trimmedApiKey.startsWith("sk-svcacct-")
  ) {
    return "openai";
  }

  return null;
}

export function detectProviderFromModel(model: string): AiProvider | null {
  const trimmedModel = trimModel(model);
  if (trimmedModel.length === 0) {
    return null;
  }

  return trimmedModel.includes("/") ? "openrouter" : "openai";
}

export function resolveAiProvider(
  providerPreference: AiProviderPreference,
  apiKey: string | undefined,
  model: string
): AiProvider {
  if (providerPreference !== "auto") {
    return providerPreference;
  }

  const detectedFromKey = typeof apiKey === "string" ? detectProviderFromApiKey(apiKey) : null;
  if (detectedFromKey) {
    return detectedFromKey;
  }

  return detectProviderFromModel(model) ?? "openai";
}

export function normalizeAiSettings(
  settings: Partial<StoredUserAiSettings> | undefined
): NormalizedAiSettings {
  const providerPreference = settings?.providerPreference ?? "auto";
  const apiKey = typeof settings?.apiKey === "string" ? trimApiKey(settings.apiKey) : undefined;
  const modelCandidate = typeof settings?.model === "string" ? trimModel(settings.model) : "";
  const resolvedProvider = resolveAiProvider(providerPreference, apiKey, modelCandidate);
  const detectedModelProvider = detectProviderFromModel(modelCandidate);
  const model =
    modelCandidate.length > 0 && (detectedModelProvider === null || detectedModelProvider === resolvedProvider)
      ? modelCandidate
      : getDefaultModelForProvider(resolvedProvider);

  return {
    providerPreference,
    resolvedProvider,
    model,
    apiKey: apiKey && apiKey.length > 0 ? apiKey : undefined,
  };
}

export function normalizeStoredUserAiSettings(
  settings: Partial<StoredUserAiSettings> | undefined
): StoredUserAiSettings {
  const normalized = normalizeAiSettings(settings);
  return {
    providerPreference: normalized.providerPreference,
    model: normalized.model,
    apiKey: normalized.apiKey,
  };
}

export function toPublicUserAiSettings(
  settings: Partial<StoredUserAiSettings> | undefined
): PublicUserAiSettings {
  const normalized = normalizeStoredUserAiSettings(settings);
  return {
    hasApiKey: typeof normalized.apiKey === "string" && normalized.apiKey.length > 0,
    providerPreference: normalized.providerPreference,
    model: normalized.model,
  };
}
