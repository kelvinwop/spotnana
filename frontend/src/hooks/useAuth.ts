import { useCallback, useEffect } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import { authApi, type LoginCredentials, type RegisterPayload } from "@/api/auth";
import { HttpError, isUnauthorizedError } from "@/api/http";
import {
  clearAccountConversationStateAtom,
  clearTransientChatStateAtom,
} from "@/atoms/chatAtoms";
import { abortAllChatRequests } from "@/utils/chatRequestRegistry";
import {
  applyAuthStateAtom,
  authSessionAtom,
  authStatusAtom,
  isAuthBootstrapPendingAtom,
  isAuthRestoreFailedAtom,
  isAuthenticatedAtom,
  tokenAtom,
  userAtom,
  type AuthRestoreFailure,
} from "@/atoms/authAtoms";

function notify(message: { title: string; description?: string; variant?: "default" | "destructive" }) {
  if (typeof window.toast === "function") {
    window.toast(message);
  }
}

function classifyAuthRestoreFailure(error: unknown): AuthRestoreFailure {
  if (!(error instanceof HttpError)) {
    return {
      kind: "unknown",
      message: error instanceof Error ? error.message : "Unknown restore failure",
    };
  }

  if (error.status >= 500) {
    return {
      kind: "server_error",
      message: error.message,
    };
  }

  if (error.status === 0) {
    return {
      kind: "network_error",
      message: error.message,
    };
  }

  return {
    kind: "unknown",
    message: error.message,
  };
}

export function useAuth() {
  const token = useAtomValue(tokenAtom);
  const user = useAtomValue(userAtom);
  const status = useAtomValue(authStatusAtom);
  const isAuthenticated = useAtomValue(isAuthenticatedAtom);
  const authSession = useAtomValue(authSessionAtom);
  const isBootstrapPending = useAtomValue(isAuthBootstrapPendingAtom);
  const isAuthRestoreFailed = useAtomValue(isAuthRestoreFailedAtom);
  const clearAccountConversationState = useSetAtom(clearAccountConversationStateAtom);
  const clearTransientChatState = useSetAtom(clearTransientChatStateAtom);
  const applyAuthState = useSetAtom(applyAuthStateAtom);

  const syncCurrentUser = useCallback(async () => {
    if (!token) {
      applyAuthState({
        token: null,
        user: null,
        restoreFailure: null,
        authStatus: "ready",
      });
      return null;
    }

    applyAuthState({
      token,
      user,
      restoreFailure: null,
      authStatus: "checking",
    });
    try {
      const response = await authApi.getCurrentUser();
      applyAuthState({
        token,
        user: response.user,
        restoreFailure: null,
        authStatus: "ready",
      });
      return response.user;
    } catch (error) {
      if (isUnauthorizedError(error)) {
        applyAuthState({
          token: null,
          user: null,
          restoreFailure: null,
          authStatus: "ready",
        });
        return null;
      }

      applyAuthState({
        token,
        user: null,
        restoreFailure: classifyAuthRestoreFailure(error),
        authStatus: "restore_failed",
      });
      return null;
    }
  }, [applyAuthState, token, user]);

  useEffect(() => {
    if (status === "idle") {
      void syncCurrentUser();
    }
  }, [status, syncCurrentUser]);

  useEffect(() => {
    if (authSession.kind !== "guest") {
      return;
    }

    abortAllChatRequests();
    clearTransientChatState();
    clearAccountConversationState();
  }, [authSession.kind, clearAccountConversationState, clearTransientChatState]);

  const login = useCallback(
    async (credentials: LoginCredentials) => {
      const response = await authApi.login(credentials);
      applyAuthState({
        token: response.token,
        user: response.user,
        restoreFailure: null,
        authStatus: "ready",
      });
      notify({ title: "Welcome back", description: "Account mode is now active." });
      return response.user;
    },
    [applyAuthState]
  );

  const register = useCallback(
    async (payload: RegisterPayload) => {
      const response = await authApi.register(payload);
      applyAuthState({
        token: response.token,
        user: response.user,
        restoreFailure: null,
        authStatus: "ready",
      });
      notify({ title: "Account created", description: "Your chats can now sync across devices." });
      return response.user;
    },
    [applyAuthState]
  );

  const logout = useCallback(async () => {
    abortAllChatRequests();
    clearTransientChatState();
    clearAccountConversationState();

    try {
      if (token) {
        await authApi.logout();
      }
    } finally {
      applyAuthState({
        token: null,
        user: null,
        restoreFailure: null,
        authStatus: "ready",
      });
      notify({ title: "Signed out", description: "You are back in guest mode." });
    }
  }, [applyAuthState, clearAccountConversationState, clearTransientChatState, token]);

  return {
    authSession,
    isBootstrapPending,
    isAuthRestoreFailed,
    token,
    user,
    status,
    isAuthenticated,
    login,
    logout,
    register,
    syncCurrentUser,
  };
}
