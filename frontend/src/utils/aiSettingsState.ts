import { normalizePersistedAiSettings } from "@/config/aiModels";
import { type PersistedAiSettings } from "@/types/chat";

type ComparableAiSettings = Pick<
  PersistedAiSettings,
  "apiKey" | "providerPreference" | "selectedModelPreset" | "customModel"
>;

export interface ChatSubmitGuardState {
  readonly isAuthenticated: boolean;
  readonly hasStoredAccountApiKey: boolean;
  readonly guestSettings: ComparableAiSettings;
}

export interface SavedApiKeyStatusMessageState {
  readonly isAuthenticated: boolean;
  readonly hasSavedApiKey: boolean;
}

export interface ApiKeyInputPlaceholderState {
  readonly isAuthenticated: boolean;
  readonly hasStoredAccountApiKey: boolean;
}

export function hasSavedGuestApiKey(settings: ComparableAiSettings): boolean {
  return normalizePersistedAiSettings(settings).apiKey.length > 0;
}

export function hasUnsavedAiSettingsChanges(
  savedSettings: ComparableAiSettings,
  draftSettings: ComparableAiSettings
): boolean {
  const normalizedSavedSettings = normalizePersistedAiSettings(savedSettings);
  const normalizedDraftSettings = normalizePersistedAiSettings(draftSettings);

  return (
    normalizedSavedSettings.apiKey !== normalizedDraftSettings.apiKey ||
    normalizedSavedSettings.providerPreference !== normalizedDraftSettings.providerPreference ||
    normalizedSavedSettings.selectedModelPreset !== normalizedDraftSettings.selectedModelPreset ||
    normalizedSavedSettings.customModel !== normalizedDraftSettings.customModel
  );
}

export function getChatSubmitDisabledReason({
  guestSettings,
  hasStoredAccountApiKey,
  isAuthenticated,
}: ChatSubmitGuardState): string | undefined {
  if (isAuthenticated) {
    return hasStoredAccountApiKey ? undefined : "Configure AI settings to start chatting.";
  }

  return hasSavedGuestApiKey(guestSettings) ? undefined : "Configure AI settings to start chatting.";
}

export function getSavedApiKeyStatusMessage({
  hasSavedApiKey,
  isAuthenticated,
}: SavedApiKeyStatusMessageState): string {
  if (hasSavedApiKey) {
    return "A saved API key is ready for chat submit.";
  }

  return isAuthenticated
    ? "No account API key is saved yet. Save the typed key to your account before sending a prompt."
    : "No guest API key is saved yet. Save one before sending a prompt.";
}

export function getApiKeyInputPlaceholder({
  hasStoredAccountApiKey,
  isAuthenticated,
}: ApiKeyInputPlaceholderState): string {
  if (!isAuthenticated) {
    return "sk-... or sk-or-...";
  }

  return hasStoredAccountApiKey
    ? "Paste a key, then choose \"Save the typed key to my account\" to replace the stored one"
    : "Paste a key, then choose \"Save the typed key to my account\" before sending a prompt";
}
