import assert from "node:assert/strict";
import { describe, test } from "bun:test";
import {
  abortAllChatRequests,
  registerChatAbortController,
  unregisterChatAbortController,
} from "@/utils/chatRequestRegistry";

describe("chatRequestRegistry", () => {
  test("abortAllChatRequests aborts every registered controller", () => {
    const first = registerChatAbortController(new AbortController());
    const second = registerChatAbortController(new AbortController());

    abortAllChatRequests();

    assert.equal(first.controller.signal.aborted, true);
    assert.equal(second.controller.signal.aborted, true);
  });

  test("unregisterChatAbortController removes a completed request from future abort-all calls", () => {
    const completed = registerChatAbortController(new AbortController());
    const active = registerChatAbortController(new AbortController());

    unregisterChatAbortController(completed.id);
    abortAllChatRequests();

    assert.equal(completed.controller.signal.aborted, false);
    assert.equal(active.controller.signal.aborted, true);
  });
});
