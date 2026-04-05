import { useCallback, useMemo } from "react";
import { useAtom, useAtomValue } from "jotai";
import { authApi } from "@/api/auth";
import { authSessionAtom, userAtom } from "@/atoms/authAtoms";
import { guestAiSettingsAtom } from "@/atoms/chatAtoms";
import {
  CUSTOM_MODEL_OPTION_ID,
  findModelOptionByModel,
  normalizeAiSettingsSelection,
  normalizePersistedAiSettings,
} from "@/config/aiModels";
import { buildAccountAiSettingsRequest, type AccountApiKeyIntent } from "@/utils/accountAiSettings";
import { hasSavedGuestApiKey } from "@/utils/aiSettingsState";
import { type PersistedAiSettings } from "@/types/chat";

interface AccountSettingsFormState extends PersistedAiSettings {
  hasApiKey: boolean;
}

export function useAiSettings() {
  const authSession = useAtomValue(authSessionAtom);
  const [user, setUser] = useAtom(userAtom);
  const [guestSettings, setGuestSettings] = useAtom(guestAiSettingsAtom);
  const isAuthenticated = authSession.kind === "account";
  const isAuthSessionResolved = authSession.kind === "guest" || authSession.kind === "account";
  const canEditGuestSettings = authSession.kind === "guest";

  const settings = useMemo<PersistedAiSettings | AccountSettingsFormState>(() => {
    if (authSession.kind !== "account" || !user) {
      return normalizePersistedAiSettings(guestSettings);
    }

    const matchedOption = findModelOptionByModel(user.aiSettings.model);
    const normalizedSelection = normalizeAiSettingsSelection({
      apiKey: "",
      providerPreference: user.aiSettings.providerPreference,
      selectedModelPreset: matchedOption?.id ?? CUSTOM_MODEL_OPTION_ID,
      customModel: matchedOption ? "" : user.aiSettings.model,
    });

    return {
      apiKey: "",
      providerPreference: normalizedSelection.providerPreference,
      selectedModelPreset: normalizedSelection.selectedModelPreset,
      customModel: normalizedSelection.customModel,
      hasApiKey: user.aiSettings.hasApiKey,
    };
  }, [authSession.kind, guestSettings, user]);

  const normalizedSelection = useMemo(
    () => normalizeAiSettingsSelection(settings),
    [settings]
  );

  const setGuestValue = useCallback(
    (patch: Partial<PersistedAiSettings>) => {
      setGuestSettings(normalizePersistedAiSettings({ ...guestSettings, ...patch }));
    },
    [guestSettings, setGuestSettings]
  );

  const updateAccountSettings = useCallback(
    async (patch: {
      providerPreference: PersistedAiSettings["providerPreference"];
      selectedModelPreset: string;
      customModel: string;
      apiKeyInput: string;
      apiKeyIntent: AccountApiKeyIntent;
    }) => {
      if (!user) {
        return;
      }

      const payload = buildAccountAiSettingsRequest({
        apiKeyInput: patch.apiKeyInput,
        apiKeyIntent: patch.apiKeyIntent,
        providerPreference: patch.providerPreference,
        selectedModelPreset: patch.selectedModelPreset,
        customModel: patch.customModel,
      });

      const response = await authApi.updateAiSettings(payload);
      setUser(response.user);
    },
    [setUser, user]
  );

  return {
    authSession,
    canEditGuestSettings,
    effectiveProviderPreference: normalizedSelection.resolvedProvider,
    hasSavedApiKey: isAuthenticated
      ? user?.aiSettings.hasApiKey ?? false
      : hasSavedGuestApiKey(guestSettings),
    hasStoredAccountApiKey: isAuthenticated ? user?.aiSettings.hasApiKey ?? false : false,
    isAuthenticated,
    isAuthSessionResolved,
    selectedModel: normalizedSelection.model,
    setGuestValue,
    settings,
    updateAccountSettings,
  };
}
