import { describe, expect, test } from "bun:test";
import { HttpError } from "@/api/http";
import {
  getApiKeyInputPlaceholder,
  getChatSubmitDisabledReason,
  getSavedApiKeyStatusMessage,
  hasSavedGuestApiKey,
  hasUnsavedAiSettingsChanges,
} from "@/utils/aiSettingsState";
import { classifyChatRequestError } from "@/utils/chatRequestState";
import { type PersistedAiSettings } from "@/types/chat";

function createSettings(overrides: Partial<PersistedAiSettings> = {}): PersistedAiSettings {
  return {
    apiKey: "",
    providerPreference: "auto",
    selectedModelPreset: "gpt-4o-mini",
    customModel: "",
    ...overrides,
  };
}

describe("aiSettingsState", () => {
  test("blocks guest submit until a saved API key exists", () => {
    expect(
      getChatSubmitDisabledReason({
        guestSettings: createSettings(),
        hasStoredAccountApiKey: false,
        isAuthenticated: false,
      })
    ).toBe("Configure AI settings to start chatting.");

    expect(
      getChatSubmitDisabledReason({
        guestSettings: createSettings({ apiKey: "  sk-test  " }),
        hasStoredAccountApiKey: false,
        isAuthenticated: false,
      })
    ).toBeUndefined();
  });

  test("keeps account-mode guard semantics unchanged", () => {
    expect(
      getChatSubmitDisabledReason({
        guestSettings: createSettings({ apiKey: "sk-test" }),
        hasStoredAccountApiKey: false,
        isAuthenticated: true,
      })
    ).toBe("Configure AI settings to start chatting.");

    expect(
      getChatSubmitDisabledReason({
        guestSettings: createSettings(),
        hasStoredAccountApiKey: true,
        isAuthenticated: true,
      })
    ).toBeUndefined();
  });

  test("describes saved-key status consistently with submit behavior", () => {
    expect(
      getSavedApiKeyStatusMessage({
        hasSavedApiKey: false,
        isAuthenticated: true,
      })
    ).toBe("No account API key is saved yet. Save the typed key to your account before sending a prompt.");

    expect(
      getSavedApiKeyStatusMessage({
        hasSavedApiKey: false,
        isAuthenticated: false,
      })
    ).toBe("No guest API key is saved yet. Save one before sending a prompt.");

    expect(
      getSavedApiKeyStatusMessage({
        hasSavedApiKey: true,
        isAuthenticated: true,
      })
    ).toBe("A saved API key is ready for chat submit.");
  });

  test("describes authenticated key entry as requiring the save action", () => {
    expect(
      getApiKeyInputPlaceholder({
        hasStoredAccountApiKey: true,
        isAuthenticated: true,
      })
    ).toBe('Paste a key, then choose "Save the typed key to my account" to replace the stored one');

    expect(
      getApiKeyInputPlaceholder({
        hasStoredAccountApiKey: false,
        isAuthenticated: true,
      })
    ).toBe('Paste a key, then choose "Save the typed key to my account" before sending a prompt');

    expect(
      getApiKeyInputPlaceholder({
        hasStoredAccountApiKey: false,
        isAuthenticated: false,
      })
    ).toBe("sk-... or sk-or-...");
  });

  test("detects guest unsaved changes from normalized saved-versus-draft settings", () => {
    const savedSettings = createSettings();
    const matchingDraft = createSettings({ apiKey: "   " });
    const changedDraft = createSettings({ apiKey: "sk-or-test", providerPreference: "openrouter" });

    expect(hasSavedGuestApiKey(savedSettings)).toBe(false);
    expect(hasSavedGuestApiKey(changedDraft)).toBe(true);
    expect(hasUnsavedAiSettingsChanges(savedSettings, matchingDraft)).toBe(false);
    expect(hasUnsavedAiSettingsChanges(savedSettings, changedDraft)).toBe(true);
  });
});

describe("chatRequestState", () => {
  test("maps missing_api_key errors to settings guidance", () => {
    const classifiedError = classifyChatRequestError(
      new HttpError("api key missing", 400, "missing_api_key"),
      "hello"
    );

    expect(classifiedError.kind).toBe("missing_api_key");
    expect(classifiedError.title).toBe("Add your API key");
    expect(classifiedError.message).toContain("Open settings");
    expect(classifiedError.prompt).toBe("hello");
  });
});
