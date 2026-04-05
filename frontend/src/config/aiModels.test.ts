import assert from "node:assert/strict";
import test from "node:test";
import { CUSTOM_MODEL_OPTION_ID, normalizeAiSettingsSelection } from "@/config/aiModels";

test("normalizeAiSettingsSelection realigns auto/openrouter settings to an openrouter model", () => {
  const normalized = normalizeAiSettingsSelection({
    apiKey: "sk-or-123",
    providerPreference: "auto",
    selectedModelPreset: "gpt-4o-mini",
    customModel: "",
  });

  assert.equal(normalized.resolvedProvider, "openrouter");
  assert.equal(normalized.model, "google/gemma-4-31b-it");
  assert.equal(normalized.selectedModelPreset, "gemma-4-31b-it");
});

test("normalizeAiSettingsSelection preserves compatible custom models", () => {
  const normalized = normalizeAiSettingsSelection({
    apiKey: "sk-or-123",
    providerPreference: "auto",
    selectedModelPreset: CUSTOM_MODEL_OPTION_ID,
    customModel: "google/gemini-2.5-flash",
  });

  assert.equal(normalized.resolvedProvider, "openrouter");
  assert.equal(normalized.selectedModelPreset, CUSTOM_MODEL_OPTION_ID);
  assert.equal(normalized.model, "google/gemini-2.5-flash");
});
