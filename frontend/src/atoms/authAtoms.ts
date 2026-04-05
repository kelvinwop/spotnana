import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import { type AuthUser } from "@/types/chat";
import { createVersionedStorage, STORAGE_VERSION } from "./persistenceAdapter";
import { isNullableString } from "./persistenceValidators";

export type AuthToken = string | null;
export type AuthenticatedUser = AuthUser | null;
export type AuthStatus = "idle" | "checking" | "ready" | "restore_failed";
export interface AuthRestoreFailure {
  readonly kind: "network_error" | "server_error" | "unknown";
  readonly message: string;
}
export type AuthSessionState =
  | {
      readonly kind: "bootstrap";
      readonly token: string;
      readonly phase: "pending" | "restore_failed";
      readonly failure: AuthRestoreFailure | null;
    }
  | { readonly kind: "guest" }
  | { readonly kind: "account"; readonly user: AuthUser };
export type AuthSessionMode = AuthSessionState["kind"];

interface AuthStateInput {
  readonly authStatus: AuthStatus;
  readonly restoreFailure: AuthRestoreFailure | null;
  readonly token: AuthToken;
  readonly user: AuthenticatedUser;
}

export type ApplyAuthStateInput = AuthStateInput;

const authTokenStorageKey = "app:auth:token:v1";
const defaultTokenValue: AuthToken = null;
const defaultUserValue: AuthenticatedUser = null;
const defaultAuthRestoreFailure: AuthRestoreFailure = {
  kind: "unknown",
  message: "We couldn’t restore your saved account session. Retry restore to continue.",
};

export function deriveAuthSessionState(input: AuthStateInput): AuthSessionState {
  if (input.user) {
    return { kind: "account", user: input.user };
  }

  if (input.token === null) {
    return { kind: "guest" };
  }

  if (input.authStatus === "restore_failed") {
    return {
      kind: "bootstrap",
      token: input.token,
      phase: "restore_failed",
      failure: input.restoreFailure ?? defaultAuthRestoreFailure,
    };
  }

  return {
    kind: "bootstrap",
    token: input.token,
    phase: "pending",
    failure: null,
  };
}

function getAuthSessionBoundaryKey(input: AuthStateInput): string {
  const authSession = deriveAuthSessionState(input);

  if (authSession.kind === "account") {
    return `account:${authSession.user.id}`;
  }

  return authSession.kind;
}

export const tokenAtom = atomWithStorage<AuthToken>(
  authTokenStorageKey,
  defaultTokenValue,
  createVersionedStorage<AuthToken>(authTokenStorageKey, STORAGE_VERSION, {
    isValid: isNullableString,
  }),
  { getOnInit: true }
);

export const userAtom = atom<AuthenticatedUser>(defaultUserValue);
export const authStatusAtom = atom<AuthStatus>("idle");
export const authRestoreFailureAtom = atom<AuthRestoreFailure | null>(null);
const authSessionBoundaryVersionValueAtom = atom(0);
export const authSessionBoundaryVersionAtom = atom((get) => get(authSessionBoundaryVersionValueAtom));
export const authSessionAtom = atom<AuthSessionState>((get) =>
  deriveAuthSessionState({
    authStatus: get(authStatusAtom),
    restoreFailure: get(authRestoreFailureAtom),
    token: get(tokenAtom),
    user: get(userAtom),
  })
);
export const applyAuthStateAtom = atom(null, (get, set, nextState: ApplyAuthStateInput) => {
  const currentState: AuthStateInput = {
    authStatus: get(authStatusAtom),
    restoreFailure: get(authRestoreFailureAtom),
    token: get(tokenAtom),
    user: get(userAtom),
  };

  if (getAuthSessionBoundaryKey(currentState) !== getAuthSessionBoundaryKey(nextState)) {
    set(authSessionBoundaryVersionValueAtom, get(authSessionBoundaryVersionValueAtom) + 1);
  }

  set(tokenAtom, nextState.token);
  set(userAtom, nextState.user);
  set(authRestoreFailureAtom, nextState.restoreFailure);
  set(authStatusAtom, nextState.authStatus);
});
export const authBootstrapPhaseAtom = atom<"pending" | "restore_failed" | null>((get) => {
  const authSession = get(authSessionAtom);
  return authSession.kind === "bootstrap" ? authSession.phase : null;
});
export const isAuthenticatedAtom = atom((get) => get(authSessionAtom).kind === "account");
export const isAuthBootstrapPendingAtom = atom((get) => get(authBootstrapPhaseAtom) === "pending");
export const isAuthRestoreFailedAtom = atom((get) => get(authBootstrapPhaseAtom) === "restore_failed");
