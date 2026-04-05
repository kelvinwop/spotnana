import { type FormEvent, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Loader2, Save } from "lucide-react";
import {
  CUSTOM_MODEL_OPTION_ID,
  CURATED_MODEL_OPTIONS,
  normalizeAiSettingsSelection,
} from "@/config/aiModels";
import { useAiSettings } from "@/hooks/useAiSettings";
import {
  getInteractiveFormControlClassName,
  getInteractivePointerClassName,
} from "@/lib/interactiveStyles";
import {
  getValidatedAiProviderPreference,
  type AccountApiKeyIntent,
} from "@/utils/accountAiSettings";
import {
  getApiKeyInputPlaceholder,
  getSavedApiKeyStatusMessage,
  hasUnsavedAiSettingsChanges,
} from "@/utils/aiSettingsState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function SavedAiSettingsPanel({ onSaveSuccess }: { onSaveSuccess?: () => void } = {}) {
  const {
    authSession,
    canEditGuestSettings,
    effectiveProviderPreference,
    hasSavedApiKey,
    hasStoredAccountApiKey,
    isAuthenticated,
    isAuthSessionResolved,
    setGuestValue,
    settings,
    updateAccountSettings,
  } = useAiSettings();
  const [apiKeyInput, setApiKeyInput] = useState(settings.apiKey);
  const [providerPreference, setProviderPreference] = useState(settings.providerPreference);
  const [selectedModelPreset, setSelectedModelPreset] = useState(settings.selectedModelPreset);
  const [customModel, setCustomModel] = useState(settings.customModel);
  const [apiKeyIntent, setApiKeyIntent] = useState<AccountApiKeyIntent>("keep");
  const [status, setStatus] = useState<"idle" | "saving">("idle");

  useEffect(() => {
    setApiKeyInput(settings.apiKey);
    setProviderPreference(settings.providerPreference);
    setSelectedModelPreset(settings.selectedModelPreset);
    setCustomModel(settings.customModel);
    setApiKeyIntent("keep");
  }, [settings.apiKey, settings.customModel, settings.providerPreference, settings.selectedModelPreset]);

  const draftSelection = useMemo(
    () =>
      normalizeAiSettingsSelection({
        apiKey: apiKeyInput,
        providerPreference,
        selectedModelPreset,
        customModel,
      }),
    [apiKeyInput, customModel, providerPreference, selectedModelPreset]
  );

  const hasUnsavedGuestChanges = useMemo(
    () =>
      !isAuthenticated &&
      hasUnsavedAiSettingsChanges(settings, {
        apiKey: draftSelection.apiKey,
        providerPreference: draftSelection.providerPreference,
        selectedModelPreset: draftSelection.selectedModelPreset,
        customModel: draftSelection.customModel,
      }),
    [
      draftSelection.apiKey,
      draftSelection.customModel,
      draftSelection.providerPreference,
      draftSelection.selectedModelPreset,
      isAuthenticated,
      settings,
    ]
  );

  const savedApiKeyStatusMessage = isAuthSessionResolved
    ? getSavedApiKeyStatusMessage({
        hasSavedApiKey,
        isAuthenticated,
      })
    : "Saved account settings are unavailable until session restore finishes.";
  const apiKeyInputPlaceholder = isAuthSessionResolved
    ? getApiKeyInputPlaceholder({
        hasStoredAccountApiKey,
        isAuthenticated,
      })
    : "Restore account session before editing settings";

  const isCustomModel = draftSelection.selectedModelPreset === CUSTOM_MODEL_OPTION_ID;
  const shouldShowApiKeyIntentHelp = isAuthenticated && hasStoredAccountApiKey;
  const isSettingsLocked = !isAuthSessionResolved;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSettingsLocked) {
      window.toast({
        title: "Account restore still in progress",
        description:
          authSession.kind === "bootstrap" && authSession.phase === "restore_failed"
            ? authSession.failure?.message ?? "We couldn’t restore your saved account session."
            : "Wait for your saved account session to finish restoring before editing settings.",
        variant: "destructive",
      });
      return;
    }

    setStatus("saving");

    try {
      if (canEditGuestSettings) {
        setGuestValue({
          apiKey: draftSelection.apiKey,
          providerPreference: draftSelection.providerPreference,
          selectedModelPreset: draftSelection.selectedModelPreset,
          customModel: draftSelection.customModel,
        });
        window.toast({
          title: "Settings saved",
          description: "Guest AI settings were saved locally in this browser.",
        });
        onSaveSuccess?.();
        return;
      }

      await updateAccountSettings({
        providerPreference: draftSelection.providerPreference,
        selectedModelPreset: draftSelection.selectedModelPreset,
        customModel: draftSelection.customModel,
        apiKeyInput: draftSelection.apiKey,
        apiKeyIntent,
      });
      window.toast({
        title: "Settings saved",
        description: "Account AI settings were updated.",
      });
      onSaveSuccess?.();
    } catch (error) {
      window.toast({
        title: "Settings update failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setStatus("idle");
    }
  }

  return (
    <form className="space-y-4" onSubmit={(event) => void handleSubmit(event)}>
      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="ai-api-key">
          API key
        </label>
        <Input
          disabled={isSettingsLocked || status === "saving"}
          id="ai-api-key"
          onChange={(event) => setApiKeyInput(event.target.value)}
          placeholder={apiKeyInputPlaceholder}
          type="password"
          value={apiKeyInput}
        />
        <div className="text-xs text-muted-foreground">{savedApiKeyStatusMessage}</div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="ai-provider-preference">
          Provider preference
        </label>
        <select
          className={getInteractiveFormControlClassName(
            "flex h-11 w-full rounded-lg border border-border/70 bg-background/60 px-4 py-2 text-sm text-foreground shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          )}
          disabled={isSettingsLocked || status === "saving"}
          id="ai-provider-preference"
          onChange={(event) => {
            setProviderPreference(
              getValidatedAiProviderPreference(event.target.value, providerPreference)
            );
          }}
          value={providerPreference}
        >
          <option value="auto">Auto detect</option>
          <option value="openai">OpenAI</option>
          <option value="openrouter">OpenRouter</option>
        </select>
        <div className="text-xs text-muted-foreground">
          Current saved provider: <span className="font-medium text-foreground">{effectiveProviderPreference}</span>
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="ai-model-preset">
          Model
        </label>
        <select
          className={getInteractiveFormControlClassName(
            "flex h-11 w-full rounded-lg border border-border/70 bg-background/60 px-4 py-2 text-sm text-foreground shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          )}
          disabled={isSettingsLocked || status === "saving"}
          id="ai-model-preset"
          onChange={(event) => setSelectedModelPreset(event.target.value)}
          value={draftSelection.selectedModelPreset}
        >
          {CURATED_MODEL_OPTIONS.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
          <option value={CUSTOM_MODEL_OPTION_ID}>Custom...</option>
        </select>
      </div>

      {isCustomModel ? (
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="ai-custom-model">
            Custom model string
          </label>
          <Input
            disabled={isSettingsLocked || status === "saving"}
            id="ai-custom-model"
            onChange={(event) => setCustomModel(event.target.value)}
            placeholder="e.g. anthropic/claude-sonnet-4-20250514"
            value={draftSelection.customModel}
          />
        </div>
      ) : null}

      {hasUnsavedGuestChanges ? (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-100">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <div className="font-medium">Unsaved guest AI settings</div>
              <div className="mt-1 text-amber-100/80">
                Your saved guest chat settings still power submit. Save AI settings before sending a prompt to use the edited key, provider, or model.
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {isAuthenticated ? (
        <div className="space-y-3 rounded-md border border-border/60 bg-background/30 p-4 text-sm text-muted-foreground">
          <div className="font-medium text-foreground">Account API key action</div>
          <fieldset className="space-y-2">
            <legend className="sr-only">Account API key action</legend>
            <label className={getInteractivePointerClassName("flex items-center gap-2")}>
              <input
                checked={apiKeyIntent === "keep"}
                className={getInteractiveFormControlClassName("h-4 w-4 border-border bg-background")}
                disabled={isSettingsLocked || status === "saving"}
                name="account-api-key-intent"
                onChange={() => setApiKeyIntent("keep")}
                type="radio"
              />
              Keep the current account key as-is
            </label>
            <label className={getInteractivePointerClassName("flex items-center gap-2")}>
              <input
                checked={apiKeyIntent === "set"}
                className={getInteractiveFormControlClassName("h-4 w-4 border-border bg-background")}
                disabled={isSettingsLocked || status === "saving"}
                name="account-api-key-intent"
                onChange={() => setApiKeyIntent("set")}
                type="radio"
              />
              Save the typed key to my account
            </label>
            {hasStoredAccountApiKey ? (
              <label className={getInteractivePointerClassName("flex items-center gap-2")}>
                <input
                  checked={apiKeyIntent === "clear"}
                  className={getInteractiveFormControlClassName("h-4 w-4 border-border bg-background")}
                  disabled={isSettingsLocked || status === "saving"}
                  name="account-api-key-intent"
                  onChange={() => setApiKeyIntent("clear")}
                  type="radio"
                />
                Clear the key currently stored on my account
              </label>
            ) : null}
          </fieldset>
          {shouldShowApiKeyIntentHelp ? (
            <div>
              Choose one action before saving. Clearing removes the stored key, while saving replaces it with the typed value.
            </div>
          ) : (
            <div>No account key is stored yet. Choose “Save the typed key to my account” to use it for chat submit.</div>
          )}
        </div>
      ) : canEditGuestSettings ? (
        <div className="rounded-md border border-border/60 bg-background/30 p-4 text-sm text-muted-foreground">
          Guest mode stores the key and model locally in this browser only.
        </div>
      ) : (
        <div className="rounded-md border border-border/60 bg-background/30 p-4 text-sm text-muted-foreground">
          {authSession.kind === "bootstrap" && authSession.phase === "restore_failed"
            ? "Saved account settings stay locked after a restore failure. Retry account restore before switching to guest behavior."
            : "Saved account settings stay locked until your account session finishes restoring."}
        </div>
      )}

      <div className="rounded-md border border-border/60 bg-background/30 p-4 text-sm text-muted-foreground">
        Current draft model: <span className="font-medium text-foreground">{draftSelection.model}</span>
      </div>

      <Button className="w-full" disabled={status === "saving" || isSettingsLocked} type="submit">
        {status === "saving" ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Saving settings...
          </>
        ) : (
          <>
            <Save className="h-4 w-4" />
            Save AI settings
          </>
        )}
      </Button>
    </form>
  );
}
