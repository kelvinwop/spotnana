import assert from "node:assert/strict";
import { describe, test } from "bun:test";
import { abortAllChatRequests } from "@/utils/chatRequestRegistry";
import { createManagedChatRequestSignal } from "@/utils/chatRequestSignal";

describe("chatRequestSignal", () => {
  test("managed signal aborts when the upstream signal aborts", () => {
    const upstream = new AbortController();
    const managed = createManagedChatRequestSignal(upstream.signal);

    upstream.abort();

    assert.equal(managed.signal.aborted, true);
    managed.dispose();
  });

  test("managed signal participates in global chat aborts until disposed", () => {
    const first = createManagedChatRequestSignal();
    const second = createManagedChatRequestSignal();

    first.dispose();
    abortAllChatRequests();

    assert.equal(first.signal.aborted, false);
    assert.equal(second.signal.aborted, true);
    second.dispose();
  });
});
