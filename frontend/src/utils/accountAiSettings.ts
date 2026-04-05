import { normalizeAiSettingsSelection } from "@/config/aiModels";
import {
  type AiProviderPreference,
  type ApiKeyChangeRequest,
  type PersistedAiSettings,
  type UpdateAccountAiSettingsRequest,
} from "@/types/chat";

export type AccountApiKeyIntent = ApiKeyChangeRequest["type"];

const aiProviderPreferenceValues = ["auto", "openai", "openrouter"] as const;

interface BuildAccountAiSettingsRequestInput
  extends Pick<PersistedAiSettings, "providerPreference" | "selectedModelPreset" | "customModel"> {
  readonly apiKeyInput: string;
  readonly apiKeyIntent: AccountApiKeyIntent;
}

export function parseAiProviderPreference(value: string): AiProviderPreference | null {
  return aiProviderPreferenceValues.find((option) => option === value) ?? null;
}

export function getValidatedAiProviderPreference(
  rawValue: string,
  currentPreference: AiProviderPreference
): AiProviderPreference {
  return parseAiProviderPreference(rawValue) ?? currentPreference;
}

export function toApiKeyChangeRequest(
  apiKeyIntent: AccountApiKeyIntent,
  apiKeyInput: string
): ApiKeyChangeRequest {
  const trimmedApiKey = apiKeyInput.trim();

  if (apiKeyIntent === "set") {
    if (trimmedApiKey.length === 0) {
      throw new Error("Paste an API key before choosing save to account.");
    }

    return {
      type: "set",
      value: trimmedApiKey,
    };
  }

  return { type: apiKeyIntent };
}

export function buildAccountAiSettingsRequest(
  input: BuildAccountAiSettingsRequestInput
): UpdateAccountAiSettingsRequest {
  const normalizedSelection = normalizeAiSettingsSelection({
    apiKey: input.apiKeyInput,
    providerPreference: input.providerPreference,
    selectedModelPreset: input.selectedModelPreset,
    customModel: input.customModel,
  });

  return {
    providerPreference: normalizedSelection.providerPreference,
    model: normalizedSelection.model,
    apiKeyChange: toApiKeyChangeRequest(input.apiKeyIntent, normalizedSelection.apiKey),
  };
}
