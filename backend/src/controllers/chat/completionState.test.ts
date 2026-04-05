import { describe, expect, it, beforeEach } from "vitest";
import {
  registerCompletionRequest,
  releaseCompletionRequest,
  resetCompletionStateForTests,
} from "./completionState";

describe("completionState", () => {
  beforeEach(() => {
    resetCompletionStateForTests();
  });

  it("rejects duplicate prompts for the same subject while the first request is in flight", () => {
    const first = registerCompletionRequest({
      mode: "guest",
      subjectId: "guest-1",
      prompt: "Summarize this itinerary",
    });

    expect(first.accepted).toBe(true);
    if (!first.accepted) {
      throw new Error("Expected first request to be accepted.");
    }

    const duplicate = registerCompletionRequest({
      mode: "guest",
      subjectId: "guest-1",
      prompt: "  summarize   this itinerary ",
    });

    expect(duplicate).toEqual({
      accepted: false,
      retryAfterMs: expect.any(Number),
    });
  });

  it("keeps newer overlapping requests registered when an older request releases", () => {
    const first = registerCompletionRequest({
      mode: "account",
      subjectId: "user-1",
      prompt: "Prompt A",
    });
    const second = registerCompletionRequest({
      mode: "account",
      subjectId: "user-1",
      prompt: "Prompt B",
    });

    expect(first.accepted).toBe(true);
    expect(second.accepted).toBe(true);
    if (!first.accepted || !second.accepted) {
      throw new Error("Expected both unique requests to be accepted.");
    }

    releaseCompletionRequest({
      mode: "account",
      subjectId: "user-1",
      prompt: "Prompt A",
      requestId: first.requestId,
    });

    const duplicateSecond = registerCompletionRequest({
      mode: "account",
      subjectId: "user-1",
      prompt: "Prompt B",
    });

    expect(duplicateSecond).toEqual({
      accepted: false,
      retryAfterMs: expect.any(Number),
    });
  });

  it("ignores release calls for stale request ids", () => {
    const accepted = registerCompletionRequest({
      mode: "guest",
      subjectId: "guest-2",
      prompt: "Prompt A",
    });

    expect(accepted.accepted).toBe(true);
    if (!accepted.accepted) {
      throw new Error("Expected request to be accepted.");
    }

    releaseCompletionRequest({
      mode: "guest",
      subjectId: "guest-2",
      prompt: "Prompt A",
      requestId: "stale-request-id",
    });

    const duplicate = registerCompletionRequest({
      mode: "guest",
      subjectId: "guest-2",
      prompt: "Prompt A",
    });

    expect(duplicate).toEqual({
      accepted: false,
      retryAfterMs: expect.any(Number),
    });
  });
});
