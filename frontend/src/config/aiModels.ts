import { type AiProvider, type AiProviderPreference, type PersistedAiSettings } from "@/types/chat";

export interface ModelOption {
  readonly id: string;
  readonly label: string;
  readonly provider: AiProvider;
  readonly model: string;
}

export interface NormalizedAiSettingsSelection {
  readonly apiKey: string;
  readonly providerPreference: AiProviderPreference;
  readonly resolvedProvider: AiProvider;
  readonly selectedModelPreset: string;
  readonly customModel: string;
  readonly model: string;
}

export const CUSTOM_MODEL_OPTION_ID = "custom";
export const DEFAULT_GUEST_SESSION_STORAGE_KEY = "app:chat:guestSessionId:v1";

export const CURATED_MODEL_OPTIONS: readonly ModelOption[] = [
  { id: "gpt-4o", label: "OpenAI · gpt-4o", provider: "openai", model: "gpt-4o" },
  {
    id: "gpt-4o-mini",
    label: "OpenAI · gpt-4o-mini",
    provider: "openai",
    model: "gpt-4o-mini",
  },
  {
    id: "gpt-3.5-turbo",
    label: "OpenAI · gpt-3.5-turbo",
    provider: "openai",
    model: "gpt-3.5-turbo",
  },
  { id: "o4-mini", label: "OpenAI · o4-mini", provider: "openai", model: "o4-mini" },
  {
    id: "gemma-4-31b-it",
    label: "OpenRouter · Gemma 4 31B IT",
    provider: "openrouter",
    model: "google/gemma-4-31b-it",
  },
  {
    id: "grok-4.20",
    label: "OpenRouter · Grok 4.20",
    provider: "openrouter",
    model: "x-ai/grok-4.20",
  },
  {
    id: "mimo-v2-pro",
    label: "OpenRouter · MiMo V2 Pro",
    provider: "openrouter",
    model: "xiaomi/mimo-v2-pro",
  },
  {
    id: "glm-5",
    label: "OpenRouter · GLM-5",
    provider: "openrouter",
    model: "z-ai/glm-5",
  },
  {
    id: "deepseek-v3.2",
    label: "OpenRouter · DeepSeek V3.2",
    provider: "openrouter",
    model: "deepseek/deepseek-v3.2",
  },
] as const;

const defaultModelByProvider: Record<AiProvider, string> = {
  openai: "gpt-4o-mini",
  openrouter: "google/gemma-4-31b-it",
};

export function getDefaultModelForProviderPreference(
  providerPreference: AiProviderPreference
): string {
  return providerPreference === "openrouter"
    ? defaultModelByProvider.openrouter
    : defaultModelByProvider.openai;
}

export function getDefaultModelForProvider(provider: AiProvider): string {
  return defaultModelByProvider[provider];
}

export function getDefaultModelOptionForProvider(provider: AiProvider): ModelOption {
  const defaultModel = getDefaultModelForProvider(provider);
  const option = findModelOptionByModel(defaultModel);
  if (!option) {
    throw new Error(`Missing curated default model for provider ${provider}.`);
  }

  return option;
}

export function detectProviderFromApiKey(apiKey: string): AiProvider | null {
  const trimmedKey = apiKey.trim();
  if (trimmedKey.startsWith("sk-or-")) {
    return "openrouter";
  }
  if (
    trimmedKey.startsWith("sk-") ||
    trimmedKey.startsWith("sk-proj-") ||
    trimmedKey.startsWith("sk-svcacct-")
  ) {
    return "openai";
  }

  return null;
}

export function findModelOptionByModel(model: string): ModelOption | null {
  const trimmedModel = model.trim();
  return CURATED_MODEL_OPTIONS.find((option) => option.model === trimmedModel) ?? null;
}

export function findModelOptionById(optionId: string): ModelOption | null {
  return CURATED_MODEL_OPTIONS.find((option) => option.id === optionId) ?? null;
}

export function detectProviderFromModel(model: string): AiProvider | null {
  const trimmedModel = model.trim();
  if (trimmedModel.length === 0) {
    return null;
  }

  const curatedProvider = findModelOptionByModel(trimmedModel)?.provider;
  if (curatedProvider) {
    return curatedProvider;
  }

  return trimmedModel.includes("/") ? "openrouter" : "openai";
}

export function resolveAiProvider(
  providerPreference: AiProviderPreference,
  apiKey: string,
  selectedModel: string
): AiProvider {
  if (providerPreference !== "auto") {
    return providerPreference;
  }

  const detectedFromKey = detectProviderFromApiKey(apiKey);
  if (detectedFromKey) {
    return detectedFromKey;
  }

  const detectedFromModel = detectProviderFromModel(selectedModel);
  return detectedFromModel ?? "openai";
}

function normalizeSelectionForProvider(
  selectedModelPreset: string,
  customModel: string,
  resolvedProvider: AiProvider
): Pick<NormalizedAiSettingsSelection, "selectedModelPreset" | "customModel" | "model"> {
  const matchedOption = findModelOptionById(selectedModelPreset);
  const shouldUseCustomModel =
    selectedModelPreset === CUSTOM_MODEL_OPTION_ID || matchedOption === null;

  if (shouldUseCustomModel) {
    const detectedCustomProvider = detectProviderFromModel(customModel);
    if (customModel.length > 0 && detectedCustomProvider !== null && detectedCustomProvider === resolvedProvider) {
      return {
        selectedModelPreset: CUSTOM_MODEL_OPTION_ID,
        customModel,
        model: customModel,
      };
    }

    const defaultOption = getDefaultModelOptionForProvider(resolvedProvider);
    return {
      selectedModelPreset: defaultOption.id,
      customModel: "",
      model: defaultOption.model,
    };
  }

  if (matchedOption.provider === resolvedProvider) {
    return {
      selectedModelPreset: matchedOption.id,
      customModel: "",
      model: matchedOption.model,
    };
  }

  const defaultOption = getDefaultModelOptionForProvider(resolvedProvider);
  return {
    selectedModelPreset: defaultOption.id,
    customModel: "",
    model: defaultOption.model,
  };
}

export function normalizeAiSettingsSelection(
  settings: Pick<PersistedAiSettings, "apiKey" | "providerPreference" | "selectedModelPreset" | "customModel">
): NormalizedAiSettingsSelection {
  const apiKey = settings.apiKey.trim();
  const customModel = settings.customModel.trim();
  const matchedOption = findModelOptionById(settings.selectedModelPreset);
  const selectedModelCandidate =
    settings.selectedModelPreset === CUSTOM_MODEL_OPTION_ID || matchedOption === null
      ? customModel
      : matchedOption.model;
  const resolvedProvider = resolveAiProvider(
    settings.providerPreference,
    apiKey,
    selectedModelCandidate
  );
  const normalizedSelection = normalizeSelectionForProvider(
    settings.selectedModelPreset,
    customModel,
    resolvedProvider
  );

  return {
    apiKey,
    providerPreference: settings.providerPreference,
    resolvedProvider,
    selectedModelPreset: normalizedSelection.selectedModelPreset,
    customModel: normalizedSelection.customModel,
    model: normalizedSelection.model,
  };
}

export function normalizePersistedAiSettings(
  settings: Pick<PersistedAiSettings, "apiKey" | "providerPreference" | "selectedModelPreset" | "customModel">
): PersistedAiSettings {
  const normalizedSelection = normalizeAiSettingsSelection(settings);
  return {
    apiKey: normalizedSelection.apiKey,
    providerPreference: normalizedSelection.providerPreference,
    selectedModelPreset: normalizedSelection.selectedModelPreset,
    customModel: normalizedSelection.customModel,
  };
}
