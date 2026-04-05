import { chatApi } from "@/api/chat";
import {
  authSessionAtom,
  authSessionBoundaryVersionAtom,
  isAuthBootstrapPendingAtom,
  isAuthRestoreFailedAtom,
  userAtom,
  type AuthSessionState,
} from "@/atoms/authAtoms";
import {
  accountConversationDetailsAtom,
  accountConversationSummariesAtom,
  activeConversationAtom,
  chatErrorAtom,
  chatStatusAtom,
  conversationDetailStatusAtom,
  conversationListStatusAtom,
  createGuestConversationAtom,
  deleteGuestConversationAtom,
  draftPromptAtom,
  ensureGuestConversationAtom,
  guestAiSettingsAtom,
  guestChatStoreAtom,
  guestConversationSummariesAtom,
  guestPendingTurnAtom,
  guestSessionIdAtom,
  isComposingNewConversationAtom,
  removeAccountConversationAtom,
  replaceAccountConversationAtom,
  saveGuestConversationAtom,
  selectedConversationIdAtom,
  syncChatSessionScopeAtom,
} from "@/atoms/chatAtoms";
import { normalizeAiSettingsSelection } from "@/config/aiModels";
import { type ConversationSummary, type GuestPendingTurn } from "@/types/chat";
import { getChatSubmitDisabledReason } from "@/utils/aiSettingsState";
import { classifyChatRequestError } from "@/utils/chatRequestState";
import {
  applyConversationMessages,
  buildHistoryForAccount,
  createMessage,
  summarizeConversation,
} from "@/utils/chatState";
import { useAtom, useAtomValue, useSetAtom, useStore } from "jotai";
import { useCallback, useEffect, useMemo, useRef } from "react";

const SUBMIT_DEBOUNCE_MS = 400;

function notify(message: {
  title: string;
  description?: string;
  variant?: "default" | "destructive";
}) {
  if (typeof window.toast === "function") {
    window.toast(message);
  }
}

interface SubmitPromptInput {
  readonly prompt?: string;
  readonly guestRetryTurn?: GuestPendingTurn | null;
  readonly bypassDebounce?: boolean;
}

interface OwnedSessionRequest {
  readonly requestId: number;
  readonly sessionKey: string;
  readonly boundaryVersion: number;
}

function getSubmitSessionKey(
  authSession: AuthSessionState,
  guestSessionId: string
): string | null {
  if (authSession.kind === "bootstrap") {
    return null;
  }

  if (authSession.kind === "guest") {
    return `guest:${guestSessionId}`;
  }

  return `account:${authSession.user.id}`;
}

export function useChatApp() {
  const store = useStore();
  const authSession = useAtomValue(authSessionAtom);
  const authSessionBoundaryVersion = useAtomValue(authSessionBoundaryVersionAtom);
  const isAuthenticated = authSession.kind === "account";
  const isAuthBootstrapPending = useAtomValue(isAuthBootstrapPendingAtom);
  const isAuthRestoreFailed = useAtomValue(isAuthRestoreFailedAtom);
  const user = useAtomValue(userAtom);
  const guestStore = useAtomValue(guestChatStoreAtom);
  const guestAiSettings = useAtomValue(guestAiSettingsAtom);
  const guestSessionId = useAtomValue(guestSessionIdAtom);
  const guestConversationSummaries = useAtomValue(guestConversationSummariesAtom);
  const accountConversationSummaries = useAtomValue(accountConversationSummariesAtom);
  const accountConversationDetails = useAtomValue(accountConversationDetailsAtom);
  const activeConversation = useAtomValue(activeConversationAtom);
  const [selectedConversationId, setSelectedConversationId] = useAtom(selectedConversationIdAtom);
  const [draftPrompt, setDraftPrompt] = useAtom(draftPromptAtom);
  const [chatStatus, setChatStatus] = useAtom(chatStatusAtom);
  const [chatError, setChatError] = useAtom(chatErrorAtom);
  const [guestPendingTurn, setGuestPendingTurn] = useAtom(guestPendingTurnAtom);
  const [conversationListStatus, setConversationListStatus] = useAtom(conversationListStatusAtom);
  const [conversationDetailStatus, setConversationDetailStatus] = useAtom(
    conversationDetailStatusAtom
  );
  const [isComposingNewConversation, setIsComposingNewConversation] = useAtom(
    isComposingNewConversationAtom
  );
  const ensureGuestConversation = useSetAtom(ensureGuestConversationAtom);
  const createGuestConversation = useSetAtom(createGuestConversationAtom);
  const saveGuestConversation = useSetAtom(saveGuestConversationAtom);
  const deleteGuestConversation = useSetAtom(deleteGuestConversationAtom);
  const replaceAccountConversation = useSetAtom(replaceAccountConversationAtom);
  const removeAccountConversation = useSetAtom(removeAccountConversationAtom);
  const setAccountConversationSummaries = useSetAtom(accountConversationSummariesAtom);
  const syncChatSessionScope = useSetAtom(syncChatSessionScopeAtom);
  const activeAbortControllerRef = useRef<AbortController | null>(null);
  const lastSubmissionRef = useRef<{ prompt: string; submittedAt: number } | null>(null);
  const nextOwnedRequestIdRef = useRef(0);
  const activeOwnedRequestRef = useRef<OwnedSessionRequest | null>(null);
  const submitSessionKey = useMemo(
    () => getSubmitSessionKey(authSession, guestSessionId),
    [authSession, guestSessionId]
  );

  const conversationSummaries = useMemo<ConversationSummary[]>(() => {
    if (authSession.kind === "account") {
      return accountConversationSummaries;
    }

    if (authSession.kind === "guest") {
      return guestConversationSummaries;
    }

    return [];
  }, [accountConversationSummaries, authSession.kind, guestConversationSummaries]);

  const isOwnedSessionStillCurrent = useCallback(
    (ownedRequest: OwnedSessionRequest): boolean =>
      store.get(authSessionBoundaryVersionAtom) === ownedRequest.boundaryVersion &&
      getSubmitSessionKey(store.get(authSessionAtom), store.get(guestSessionIdAtom)) ===
        ownedRequest.sessionKey,
    [store]
  );

  const createOwnedRequest = useCallback((): OwnedSessionRequest | null => {
    if (submitSessionKey === null) {
      return null;
    }

    const ownedRequest: OwnedSessionRequest = {
      requestId: nextOwnedRequestIdRef.current + 1,
      sessionKey: submitSessionKey,
      boundaryVersion: authSessionBoundaryVersion,
    };
    nextOwnedRequestIdRef.current = ownedRequest.requestId;
    activeOwnedRequestRef.current = ownedRequest;
    return ownedRequest;
  }, [authSessionBoundaryVersion, submitSessionKey]);

  const isOwnedRequestCurrent = useCallback(
    (ownedRequest: OwnedSessionRequest): boolean => {
      const activeOwnedRequest = activeOwnedRequestRef.current;
      if (activeOwnedRequest === null || activeOwnedRequest.requestId !== ownedRequest.requestId) {
        return false;
      }

      return isOwnedSessionStillCurrent(ownedRequest);
    },
    [isOwnedSessionStillCurrent]
  );

  const finalizeOwnedRequest = useCallback(
    (ownedRequest: OwnedSessionRequest, abortController: AbortController) => {
      const shouldResetChatStatus =
        activeOwnedRequestRef.current?.requestId === ownedRequest.requestId;
      if (shouldResetChatStatus) {
        activeOwnedRequestRef.current = null;
      }
      if (activeAbortControllerRef.current === abortController) {
        activeAbortControllerRef.current = null;
      }
      if (shouldResetChatStatus) {
        setChatStatus("idle");
      }
    },
    [setChatStatus]
  );

  useEffect(() => {
    return () => {
      activeAbortControllerRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    lastSubmissionRef.current = null;
  }, [authSession.kind]);

  useEffect(() => {
    syncChatSessionScope();
  }, [
    accountConversationDetails,
    accountConversationSummaries,
    authSession.kind,
    guestStore.conversations,
    isComposingNewConversation,
    selectedConversationId,
    syncChatSessionScope,
  ]);

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }
    if (!isComposingNewConversation) {
      return;
    }
    if (!selectedConversationId) {
      return;
    }
    setIsComposingNewConversation(false);
  }, [
    isAuthenticated,
    isComposingNewConversation,
    selectedConversationId,
    setIsComposingNewConversation,
  ]);

  useEffect(() => {
    if (!isAuthenticated || submitSessionKey === null) {
      return;
    }

    const ownedRequest: OwnedSessionRequest = {
      requestId: nextOwnedRequestIdRef.current + 1,
      sessionKey: submitSessionKey,
      boundaryVersion: authSessionBoundaryVersion,
    };
    nextOwnedRequestIdRef.current = ownedRequest.requestId;
    let cancelled = false;
    setConversationListStatus("loading");

    async function loadConversations() {
      try {
        const response = await chatApi.listConversations();
        if (cancelled || !isOwnedSessionStillCurrent(ownedRequest)) {
          return;
        }
        setAccountConversationSummaries(response.conversations);
        setConversationListStatus("ready");
      } catch (error) {
        if (cancelled || !isOwnedSessionStillCurrent(ownedRequest)) {
          return;
        }
        setConversationListStatus("ready");
        setChatError(classifyChatRequestError(error));
      }
    }

    void loadConversations();

    return () => {
      cancelled = true;
    };
  }, [
    authSessionBoundaryVersion,
    isAuthenticated,
    isOwnedSessionStillCurrent,
    setAccountConversationSummaries,
    setChatError,
    setConversationListStatus,
    submitSessionKey,
  ]);

  useEffect(() => {
    if (
      !isAuthenticated ||
      submitSessionKey === null ||
      !selectedConversationId ||
      accountConversationDetails[selectedConversationId]
    ) {
      return;
    }

    const conversationId = selectedConversationId;
    const ownedRequest: OwnedSessionRequest = {
      requestId: nextOwnedRequestIdRef.current + 1,
      sessionKey: submitSessionKey,
      boundaryVersion: authSessionBoundaryVersion,
    };
    nextOwnedRequestIdRef.current = ownedRequest.requestId;
    let cancelled = false;
    setConversationDetailStatus("loading");

    async function loadConversation() {
      try {
        const response = await chatApi.getConversation(conversationId);
        if (cancelled || !isOwnedSessionStillCurrent(ownedRequest)) {
          return;
        }
        replaceAccountConversation(response.conversation);
        setConversationDetailStatus("ready");
      } catch (error) {
        if (cancelled || !isOwnedSessionStillCurrent(ownedRequest)) {
          return;
        }
        setConversationDetailStatus("ready");
        setChatError(classifyChatRequestError(error));
      }
    }

    void loadConversation();

    return () => {
      cancelled = true;
    };
  }, [
    accountConversationDetails,
    authSessionBoundaryVersion,
    isAuthenticated,
    isOwnedSessionStillCurrent,
    replaceAccountConversation,
    selectedConversationId,
    setChatError,
    setConversationDetailStatus,
    submitSessionKey,
  ]);

  const startNewConversation = useCallback(() => {
    if (isAuthBootstrapPending || isAuthRestoreFailed) {
      return;
    }

    setChatError(null);
    setGuestPendingTurn(null);
    if (isAuthenticated) {
      setIsComposingNewConversation(true);
      setSelectedConversationId(null);
      setDraftPrompt("");
      return;
    }

    const conversationId = createGuestConversation();
    setSelectedConversationId(conversationId);
    setDraftPrompt("");
  }, [
    createGuestConversation,
    isAuthBootstrapPending,
    isAuthRestoreFailed,
    isAuthenticated,
    setChatError,
    setDraftPrompt,
    setGuestPendingTurn,
    setIsComposingNewConversation,
    setSelectedConversationId,
  ]);

  const clearDraftPrompt = useCallback(() => {
    setDraftPrompt("");
    setChatError(null);
  }, [setChatError, setDraftPrompt]);

  const renameConversation = useCallback(
    async (conversationId: string, title: string) => {
      if (isAuthBootstrapPending || isAuthRestoreFailed) {
        return;
      }

      const trimmedTitle = title.trim();
      if (trimmedTitle.length === 0) {
        return;
      }

      if (!isAuthenticated) {
        const match = guestStore.conversations.find(
          (conversation) => conversation.id === conversationId
        );
        if (!match) {
          return;
        }
        saveGuestConversation({
          ...match,
          title: trimmedTitle,
        });
        return;
      }

      try {
        const response = await chatApi.renameConversation(conversationId, trimmedTitle);
        replaceAccountConversation(response.conversation);
      } catch (error) {
        const classifiedError = classifyChatRequestError(error);
        notify({
          title: "Rename failed",
          description: classifiedError.message,
          variant: "destructive",
        });
      }
    },
    [
      guestStore.conversations,
      isAuthBootstrapPending,
      isAuthRestoreFailed,
      isAuthenticated,
      replaceAccountConversation,
      saveGuestConversation,
    ]
  );

  const deleteConversation = useCallback(
    async (conversationId: string) => {
      if (isAuthBootstrapPending || isAuthRestoreFailed) {
        return;
      }

      if (!isAuthenticated) {
        deleteGuestConversation(conversationId);
        if (guestPendingTurn?.conversationId === conversationId) {
          setGuestPendingTurn(null);
          setChatError(null);
        }
        return;
      }

      try {
        await chatApi.deleteConversation(conversationId);
        removeAccountConversation(conversationId);
      } catch (error) {
        const classifiedError = classifyChatRequestError(error);
        notify({
          title: "Delete failed",
          description: classifiedError.message,
          variant: "destructive",
        });
      }
    },
    [
      deleteGuestConversation,
      guestPendingTurn?.conversationId,
      isAuthBootstrapPending,
      isAuthRestoreFailed,
      isAuthenticated,
      removeAccountConversation,
      setChatError,
      setGuestPendingTurn,
    ]
  );

  const clearAllGuestConversations = useCallback(() => {
    if (isAuthBootstrapPending || isAuthRestoreFailed || isAuthenticated) {
      return;
    }

    for (const conversation of guestStore.conversations) {
      deleteGuestConversation(conversation.id);
    }
    setGuestPendingTurn(null);
    setChatError(null);
    setSelectedConversationId(null);
  }, [
    deleteGuestConversation,
    guestStore.conversations,
    isAuthBootstrapPending,
    isAuthRestoreFailed,
    isAuthenticated,
    setChatError,
    setGuestPendingTurn,
    setSelectedConversationId,
  ]);

  const sidebarSummaries = useMemo(() => {
    if (authSession.kind !== "account") {
      return conversationSummaries;
    }

    return conversationSummaries.map((summary) => {
      const detail = accountConversationDetails[summary.id];
      return detail ? summarizeConversation(detail) : summary;
    });
  }, [accountConversationDetails, authSession.kind, conversationSummaries]);

  const submitDisabledReason = useMemo(() => {
    if (authSession.kind === "bootstrap") {
      return authSession.phase === "restore_failed"
        ? authSession.failure?.message ?? "We couldn’t restore your saved account session."
        : "Restoring your saved account session…";
    }

    return getChatSubmitDisabledReason({
      guestSettings: guestAiSettings,
      hasStoredAccountApiKey: user?.aiSettings.hasApiKey ?? false,
      isAuthenticated,
    });
  }, [authSession, guestAiSettings, isAuthenticated, user?.aiSettings.hasApiKey]);

  const retryPrompt = useMemo(() => {
    if (authSession.kind === "bootstrap") {
      return null;
    }

    return isAuthenticated ? (chatError?.prompt ?? null) : (guestPendingTurn?.prompt ?? null);
  }, [authSession.kind, chatError?.prompt, guestPendingTurn?.prompt, isAuthenticated]);

  const submitPrompt = useCallback(
    async (input?: SubmitPromptInput) => {
      if (isAuthBootstrapPending || isAuthRestoreFailed) {
        return;
      }

      const prompt = (input?.prompt ?? draftPrompt).trim();
      if (prompt.length === 0 || chatStatus !== "idle") {
        return;
      }

      if (!isAuthenticated && submitDisabledReason) {
        notify({
          title: "Save AI settings first",
          description: submitDisabledReason,
          variant: "destructive",
        });
        return;
      }

      const now = Date.now();
      const lastSubmission = lastSubmissionRef.current;
      if (
        !input?.bypassDebounce &&
        lastSubmission &&
        lastSubmission.prompt === prompt &&
        now - lastSubmission.submittedAt < SUBMIT_DEBOUNCE_MS
      ) {
        return;
      }

      activeAbortControllerRef.current?.abort();
      const abortController = new AbortController();
      activeAbortControllerRef.current = abortController;
      const ownedRequest = createOwnedRequest();

      if (ownedRequest === null) {
        activeAbortControllerRef.current = null;
        return;
      }

      setChatStatus("submitting");
      setChatError(null);
      setDraftPrompt("");
      lastSubmissionRef.current = { prompt, submittedAt: now };

      if (!isAuthenticated) {
        const retryTurn = input?.guestRetryTurn ?? null;
        const ensuredConversation = retryTurn
          ? (guestStore.conversations.find((item) => item.id === retryTurn.conversationId) ?? null)
          : selectedConversationId
            ? (guestStore.conversations.find((item) => item.id === selectedConversationId) ?? null)
            : ensureGuestConversation(prompt);

        if (!ensuredConversation) {
          finalizeOwnedRequest(ownedRequest, abortController);
          return;
        }

        const conversation = ensuredConversation;
        const baseMessages = retryTurn?.baseMessages ?? conversation.messages;
        const normalizedGuestSettings = normalizeAiSettingsSelection(guestAiSettings);
        const userMessage =
          retryTurn === null
            ? createMessage("user", prompt)
            : (conversation.messages.find((message) => message.id === retryTurn.userMessageId) ??
              createMessage("user", retryTurn.prompt));
        const pendingConversation =
          retryTurn === null
            ? applyConversationMessages(conversation, [...baseMessages, userMessage])
            : conversation;

        if (retryTurn === null) {
          saveGuestConversation(pendingConversation);
        }

        const nextPendingTurn: GuestPendingTurn = {
          requestId: retryTurn?.requestId ?? crypto.randomUUID(),
          prompt,
          conversationId: pendingConversation.id,
          userMessageId: userMessage.id,
          baseMessages,
        };

        setGuestPendingTurn(nextPendingTurn);
        setSelectedConversationId(pendingConversation.id);
        setChatStatus("waiting_for_first_token");

        try {
          const response = await chatApi.createGuestCompletion(
            {
              guestSessionId,
              prompt,
              history: buildHistoryForAccount(baseMessages),
              apiKey: normalizedGuestSettings.apiKey,
              providerPreference: normalizedGuestSettings.providerPreference,
              model: normalizedGuestSettings.model,
            },
            abortController.signal
          );

          if (!isOwnedRequestCurrent(ownedRequest)) {
            return;
          }

          saveGuestConversation(
            applyConversationMessages(pendingConversation, [
              ...pendingConversation.messages,
              response.message,
            ])
          );
          setGuestPendingTurn(null);
        } catch (error) {
          if (!isOwnedRequestCurrent(ownedRequest)) {
            return;
          }

          const classifiedError = classifyChatRequestError(error, prompt);
          setChatError(classifiedError);
          if (classifiedError.kind !== "aborted") {
            notify({
              title: classifiedError.title,
              description: classifiedError.message,
              variant: "destructive",
            });
          }
        } finally {
          finalizeOwnedRequest(ownedRequest, abortController);
        }
        return;
      }

      setGuestPendingTurn(null);

      try {
        setChatStatus("waiting_for_first_token");
        const history = activeConversation
          ? buildHistoryForAccount(activeConversation.messages)
          : [];
        const response = await chatApi.createCompletion(
          {
            conversationId: activeConversation?.id,
            prompt,
            history,
          },
          abortController.signal
        );

        if (!isOwnedRequestCurrent(ownedRequest)) {
          return;
        }

        replaceAccountConversation(response.conversation);
        setSelectedConversationId(response.conversation.id);
      } catch (error) {
        if (!isOwnedRequestCurrent(ownedRequest)) {
          return;
        }

        const classifiedError = classifyChatRequestError(error, prompt);
        setChatError(classifiedError);
        if (classifiedError.kind !== "aborted") {
          notify({
            title: classifiedError.title,
            description: classifiedError.message,
            variant: "destructive",
          });
        }
      } finally {
        finalizeOwnedRequest(ownedRequest, abortController);
      }
    },
    [
      activeConversation,
      chatStatus,
      createOwnedRequest,
      draftPrompt,
      ensureGuestConversation,
      finalizeOwnedRequest,
      guestAiSettings,
      guestSessionId,
      guestStore.conversations,
      isAuthBootstrapPending,
      isAuthRestoreFailed,
      isAuthenticated,
      isOwnedRequestCurrent,
      replaceAccountConversation,
      saveGuestConversation,
      selectedConversationId,
      setChatError,
      setChatStatus,
      setDraftPrompt,
      setGuestPendingTurn,
      setSelectedConversationId,
      submitDisabledReason,
    ]
  );

  const retryLastPrompt = useCallback(async () => {
    if (isAuthBootstrapPending || isAuthRestoreFailed) {
      return;
    }

    if (isAuthenticated) {
      if (!chatError?.prompt) {
        return;
      }

      await submitPrompt({
        prompt: chatError.prompt,
        bypassDebounce: true,
      });
      return;
    }

    if (!guestPendingTurn) {
      return;
    }

    await submitPrompt({
      prompt: guestPendingTurn.prompt,
      guestRetryTurn: guestPendingTurn,
      bypassDebounce: true,
    });
  }, [
    chatError?.prompt,
    guestPendingTurn,
    isAuthBootstrapPending,
    isAuthRestoreFailed,
    isAuthenticated,
    submitPrompt,
  ]);

  return {
    activeConversation,
    authSession,
    chatError,
    chatStatus,
    clearAllGuestConversations,
    conversationDetailStatus,
    conversationListStatus,
    conversationSummaries: sidebarSummaries,
    deleteConversation,
    draftPrompt,
    hasStoredAccountApiKey: user?.aiSettings.hasApiKey ?? false,
    isAuthenticated,
    isAuthBootstrapPending,
    isAuthRestoreFailed,
    renameConversation,
    retryLastPrompt,
    retryPrompt,
    selectedConversationId,
    setDraftPrompt,
    setSelectedConversationId,
    startNewConversation,
    clearDraftPrompt,
    submitDisabledReason,
    submitPrompt,
  };
}
