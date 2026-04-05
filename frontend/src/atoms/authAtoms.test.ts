import assert from "node:assert/strict";
import { describe, test } from "bun:test";
import { createStore } from "jotai";
import {
  applyAuthStateAtom,
  authRestoreFailureAtom,
  authSessionAtom,
  authSessionBoundaryVersionAtom,
  authStatusAtom,
  deriveAuthSessionState,
  isAuthBootstrapPendingAtom,
  isAuthRestoreFailedAtom,
  isAuthenticatedAtom,
  tokenAtom,
  userAtom,
} from "@/atoms/authAtoms";
import { type AuthUser } from "@/types/chat";

const authenticatedUser: AuthUser = {
  id: "user-1",
  username: "spotnana-kelvin",
  email: "spotnana@example.com",
  role: "user",
  aiSettings: {
    hasApiKey: true,
    providerPreference: "openai",
    model: "gpt-4o-mini",
  },
};

describe("authAtoms session state", () => {
  test("treats a persisted token as bootstrap instead of guest until auth resolves", () => {
    const store = createStore();

    store.set(tokenAtom, "persisted-token");

    assert.deepEqual(store.get(authSessionAtom), {
      kind: "bootstrap",
      token: "persisted-token",
      phase: "pending",
      failure: null,
    });
    assert.equal(store.get(isAuthBootstrapPendingAtom), true);
    assert.equal(store.get(isAuthRestoreFailedAtom), false);
    assert.equal(store.get(isAuthenticatedAtom), false);
  });

  test("transitions from bootstrap to account when the current user is restored", () => {
    const store = createStore();

    store.set(tokenAtom, "persisted-token");
    store.set(userAtom, authenticatedUser);
    store.set(authStatusAtom, "ready");

    assert.deepEqual(store.get(authSessionAtom), {
      kind: "account",
      user: authenticatedUser,
    });
    assert.equal(store.get(isAuthBootstrapPendingAtom), false);
    assert.equal(store.get(isAuthRestoreFailedAtom), false);
    assert.equal(store.get(isAuthenticatedAtom), true);
  });

  test("transitions from bootstrap to guest when auth restoration finishes without a user", () => {
    const store = createStore();

    store.set(tokenAtom, "persisted-token");
    store.set(tokenAtom, null);
    store.set(authStatusAtom, "ready");

    assert.deepEqual(store.get(authSessionAtom), {
      kind: "guest",
    });
    assert.equal(store.get(isAuthBootstrapPendingAtom), false);
    assert.equal(store.get(isAuthRestoreFailedAtom), false);
    assert.equal(store.get(isAuthenticatedAtom), false);
  });

  test("preserves a restore_failed bootstrap session instead of collapsing a persisted token into guest mode", () => {
    const store = createStore();

    store.set(tokenAtom, "persisted-token");
    store.set(authRestoreFailureAtom, {
      kind: "server_error",
      message: "Auth service is temporarily unavailable.",
    });
    store.set(authStatusAtom, "restore_failed");

    assert.deepEqual(store.get(authSessionAtom), {
      kind: "bootstrap",
      token: "persisted-token",
      phase: "restore_failed",
      failure: {
        kind: "server_error",
        message: "Auth service is temporarily unavailable.",
      },
    });
    assert.equal(store.get(isAuthBootstrapPendingAtom), false);
    assert.equal(store.get(isAuthRestoreFailedAtom), true);
    assert.equal(store.get(isAuthenticatedAtom), false);
  });

  test("shared selectors distinguish pending bootstrap from restore failure", () => {
    const store = createStore();

    store.set(tokenAtom, "persisted-token");
    assert.equal(store.get(isAuthBootstrapPendingAtom), true);
    assert.equal(store.get(isAuthRestoreFailedAtom), false);

    store.set(authRestoreFailureAtom, {
      kind: "network_error",
      message: "Network request failed.",
    });
    store.set(authStatusAtom, "restore_failed");

    assert.equal(store.get(isAuthBootstrapPendingAtom), false);
    assert.equal(store.get(isAuthRestoreFailedAtom), true);
  });

  test("deriveAuthSessionState treats token plus restore failure as explicit bootstrap restore_failed state", () => {
    assert.deepEqual(
      deriveAuthSessionState({
        authStatus: "restore_failed",
        restoreFailure: {
          kind: "network_error",
          message: "Network request failed.",
        },
        token: "persisted-token",
        user: null,
      }),
      {
        kind: "bootstrap",
        token: "persisted-token",
        phase: "restore_failed",
        failure: {
          kind: "network_error",
          message: "Network request failed.",
        },
      }
    );
  });

describe("auth session boundary version", () => {
  test("increments only when the authoritative session partition changes", () => {
    const store = createStore();

    assert.equal(store.get(authSessionBoundaryVersionAtom), 0);

    store.set(applyAuthStateAtom, {
      token: "persisted-token",
      user: null,
      restoreFailure: null,
      authStatus: "checking",
    });
    assert.equal(store.get(authSessionBoundaryVersionAtom), 1);
    assert.deepEqual(store.get(authSessionAtom), {
      kind: "bootstrap",
      token: "persisted-token",
      phase: "pending",
      failure: null,
    });

    store.set(applyAuthStateAtom, {
      token: "persisted-token",
      user: null,
      restoreFailure: {
        kind: "network_error",
        message: "Network request failed.",
      },
      authStatus: "restore_failed",
    });
    assert.equal(store.get(authSessionBoundaryVersionAtom), 1);

    store.set(applyAuthStateAtom, {
      token: "persisted-token",
      user: authenticatedUser,
      restoreFailure: null,
      authStatus: "ready",
    });
    assert.equal(store.get(authSessionBoundaryVersionAtom), 2);
    assert.deepEqual(store.get(authSessionAtom), {
      kind: "account",
      user: authenticatedUser,
    });

    store.set(applyAuthStateAtom, {
      token: null,
      user: null,
      restoreFailure: null,
      authStatus: "ready",
    });
    assert.equal(store.get(authSessionBoundaryVersionAtom), 3);
    assert.deepEqual(store.get(authSessionAtom), {
      kind: "guest",
    });
  });
});

});
