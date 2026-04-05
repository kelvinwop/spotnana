export type ChatRole = "system" | "user" | "assistant";
export type ConversationMode = "guest" | "account";
export type AiProvider = "openai" | "openrouter";
export type AiProviderPreference = AiProvider | "auto";
export type ChatRequestStatus = "idle" | "submitting" | "waiting_for_first_token";
export type ChatFailureKind =
  | "missing_api_key"
  | "invalid_api_key"
  | "rate_limited"
  | "server_error"
  | "network_error"
  | "duplicate_request"
  | "aborted"
  | "invalid_request"
  | "unknown";

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: string;
}

export interface ConversationSummary {
  id: string;
  title: string;
  updatedAt: string;
  createdAt: string;
  messageCount: number;
  owner: ConversationMode;
}

export interface ConversationRecord extends ConversationSummary {
  messages: ChatMessage[];
}

export interface ConversationListResponse {
  mode: ConversationMode;
  conversations: ConversationSummary[];
}

export interface ConversationResponse {
  mode: ConversationMode;
  conversation: ConversationRecord;
}

export interface PublicAiSettings {
  hasApiKey: boolean;
  providerPreference: AiProviderPreference;
  model: string;
}

export interface AuthUser {
  id: string;
  username: string;
  email: string;
  role: string;
  aiSettings: PublicAiSettings;
}

export interface AuthResponse {
  token: string;
  user: AuthUser;
}

export interface CurrentUserResponse {
  user: AuthUser;
}

export interface AuthChatMessageInput {
  role: Extract<ChatRole, "user" | "assistant">;
  content: string;
}

export interface AccountCompletionRequest {
  conversationId?: string;
  prompt: string;
  history: AuthChatMessageInput[];
}

export interface GuestCompletionRequest {
  guestSessionId: string;
  prompt: string;
  history: AuthChatMessageInput[];
  apiKey: string;
  providerPreference: AiProviderPreference;
  model: string;
}

export interface GuestCompletionResponse {
  mode: "guest";
  message: ChatMessage;
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

export interface UpdateAccountAiSettingsResponse {
  user: AuthUser;
}

export interface PersistedAiSettings {
  apiKey: string;
  providerPreference: AiProviderPreference;
  selectedModelPreset: string;
  customModel: string;
}

export interface ChatRequestError {
  kind: ChatFailureKind;
  title: string;
  message: string;
  status?: number;
  prompt?: string;
}

export interface GuestPendingTurn {
  requestId: string;
  prompt: string;
  conversationId: string;
  userMessageId: string;
  baseMessages: ChatMessage[];
}
