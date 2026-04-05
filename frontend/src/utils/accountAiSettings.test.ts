import assert from "node:assert/strict";
import { describe, test } from "bun:test";
import {
  buildAccountAiSettingsRequest,
  getValidatedAiProviderPreference,
  parseAiProviderPreference,
  toApiKeyChangeRequest,
} from "@/utils/accountAiSettings";

describe("accountAiSettings", () => {
  test("parses only supported provider preference values", () => {
    assert.equal(parseAiProviderPreference("auto"), "auto");
    assert.equal(parseAiProviderPreference("openai"), "openai");
    assert.equal(parseAiProviderPreference("openrouter"), "openrouter");
    assert.equal(parseAiProviderPreference("anthropic"), null);
  });

  test("keeps the current provider preference when select ingress is invalid", () => {
    assert.equal(getValidatedAiProviderPreference("openrouter", "auto"), "openrouter");
    assert.equal(getValidatedAiProviderPreference("anthropic", "openai"), "openai");
  });

  test("builds mutually exclusive api key change requests", () => {
    assert.deepEqual(toApiKeyChangeRequest("keep", "  sk-test  "), { type: "keep" });
    assert.deepEqual(toApiKeyChangeRequest("clear", "  sk-test  "), { type: "clear" });
    assert.deepEqual(toApiKeyChangeRequest("set", "  sk-test  "), {
      type: "set",
      value: "sk-test",
    });
  });

  test("rejects saving an empty account api key", () => {
    assert.throws(
      () => toApiKeyChangeRequest("set", "   "),
      /Paste an API key before choosing save to account\./
    );
  });

  test("normalizes model selection while preserving the explicit api key intent", () => {
    assert.deepEqual(
      buildAccountAiSettingsRequest({
        apiKeyInput: "sk-or-test",
        apiKeyIntent: "clear",
        providerPreference: "auto",
        selectedModelPreset: "gpt-4o-mini",
        customModel: "",
      }),
      {
        providerPreference: "auto",
        model: "google/gemma-4-31b-it",
        apiKeyChange: { type: "clear" },
      }
    );
  });
});
