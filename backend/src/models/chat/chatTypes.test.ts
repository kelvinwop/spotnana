import { describe, expect, it } from "vitest";
import { normalizeAiSettings, trimApiKey } from "./chatTypes";

describe("normalizeAiSettings", () => {
  it("switches auto provider to openrouter defaults when the API key is OpenRouter-style", () => {
    const normalized = normalizeAiSettings({
      apiKey: "sk-or-123",
      providerPreference: "auto",
      model: "gpt-4o-mini",
    });

    expect(normalized.resolvedProvider).toBe("openrouter");
    expect(normalized.model).toBe("anthropic/claude-sonnet-4-20250514");
  });

  it("keeps compatible custom models when their provider matches the resolved provider", () => {
    const normalized = normalizeAiSettings({
      apiKey: "sk-or-123",
      providerPreference: "auto",
      model: "anthropic/claude-sonnet-4-20250514",
    });

    expect(normalized.resolvedProvider).toBe("openrouter");
    expect(normalized.model).toBe("anthropic/claude-sonnet-4-20250514");
  });

  it("falls back to openai defaults when auto mode has no detectable provider input", () => {
    const normalized = normalizeAiSettings({
      providerPreference: "auto",
      model: "",
    });

    expect(normalized.resolvedProvider).toBe("openai");
    expect(normalized.model).toBe("gpt-4o-mini");
  });

  it("trims stored api keys consistently before persistence decisions", () => {
    expect(trimApiKey("  sk-test  ")).toBe("sk-test");
  });
});
