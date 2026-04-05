import {
  DEFAULT_GUEST_SESSION_STORAGE_KEY,
  getDefaultModelForProvider,
  getDefaultModelOptionForProvider,
  normalizePersistedAiSettings,
} from "@/config/aiModels";
import {
  type ChatRequestError,
  type ChatRequestStatus,
  type ConversationRecord,
  type ConversationSummary,
  type GuestPendingTurn,
  type PersistedAiSettings,
} from "@/types/chat";
import {
  createEmptyConversation,
  removeConversationSummary,
  sortConversationSummaries,
  summarizeConversation,
  upsertConversationSummary,
} from "@/utils/chatState";
import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import { authSessionAtom } from "./authAtoms";
import { createVersionedStorage, STORAGE_VERSION } from "./persistenceAdapter";
import {
  isGuestChatStore,
  isNonEmptyString,
  isNullableString,
  isPersistedAiSettings,
} from "./persistenceValidators";

interface GuestChatStore {
  conversations: ConversationRecord[];
}

const guestStoreStorageKey = "app:chat:guestStore:v1";
const guestSelectedConversationStorageKey = "app:chat:guestSelectedConversationId:v1";
const guestAiSettingsStorageKey = "app:prefs:guestAiSettings:v1";
const guestSessionIdStorageKey = DEFAULT_GUEST_SESSION_STORAGE_KEY;
const emptyGuestStore: GuestChatStore = {
  conversations: [],
};

function createGuestSessionId(): string {
  return crypto.randomUUID();
}

function createDefaultGuestAiSettings(): PersistedAiSettings {
  const providerPreference = "auto" as const;
  const defaultOption = getDefaultModelOptionForProvider("openai");

  return normalizePersistedAiSettings({
    apiKey: "",
    providerPreference,
    selectedModelPreset: defaultOption.id,
    customModel: getDefaultModelForProvider("openai"),
  });
}

export const guestChatStoreAtom = atomWithStorage<GuestChatStore>(
  guestStoreStorageKey,
  emptyGuestStore,
  createVersionedStorage<GuestChatStore>(guestStoreStorageKey, STORAGE_VERSION, {
    isValid: isGuestChatStore,
  }),
  { getOnInit: true }
);

export const guestSelectedConversationIdAtom = atomWithStorage<string | null>(
  guestSelectedConversationStorageKey,
  null,
  createVersionedStorage<string | null>(guestSelectedConversationStorageKey, STORAGE_VERSION, {
    isValid: isNullableString,
  }),
  { getOnInit: true }
);

export const accountSelectedConversationIdAtom = atom<string | null>(null);

export const selectedConversationIdAtom = atom(
  (get) => {
    const authSession = get(authSessionAtom);
    if (authSession.kind === "account") {
      return get(accountSelectedConversationIdAtom);
    }

    if (authSession.kind === "guest") {
      return get(guestSelectedConversationIdAtom);
    }

    return null;
  },
  (get, set, nextSelectedConversationId: string | null) => {
    const authSession = get(authSessionAtom);
    if (authSession.kind === "account") {
      const isKnownAccountConversation =
        nextSelectedConversationId === null ||
        get(accountConversationSummariesAtom).some(
          (conversation) => conversation.id === nextSelectedConversationId
        ) ||
        Object.prototype.hasOwnProperty.call(
          get(accountConversationDetailsAtom),
          nextSelectedConversationId
        );

      if (isKnownAccountConversation) {
        set(accountSelectedConversationIdAtom, nextSelectedConversationId);
      }
      return;
    }

    if (authSession.kind === "guest") {
      const isKnownGuestConversation =
        nextSelectedConversationId === null ||
        get(guestChatStoreAtom).conversations.some(
          (conversation) => conversation.id === nextSelectedConversationId
        );

      if (isKnownGuestConversation) {
        set(guestSelectedConversationIdAtom, nextSelectedConversationId);
      }
      return;
    }

    if (nextSelectedConversationId === null) {
      set(accountSelectedConversationIdAtom, null);
      set(guestSelectedConversationIdAtom, null);
    }
  }
);

export const guestAiSettingsAtom = atomWithStorage<PersistedAiSettings>(
  guestAiSettingsStorageKey,
  createDefaultGuestAiSettings(),
  createVersionedStorage<PersistedAiSettings>(guestAiSettingsStorageKey, STORAGE_VERSION, {
    isValid: isPersistedAiSettings,
  }),
  { getOnInit: true }
);

export const guestSessionIdAtom = atomWithStorage<string>(
  guestSessionIdStorageKey,
  createGuestSessionId(),
  createVersionedStorage<string>(guestSessionIdStorageKey, STORAGE_VERSION, {
    isValid: isNonEmptyString,
  }),
  { getOnInit: true }
);

export const guestConversationSummariesAtom = atom<ConversationSummary[]>((get) =>
  sortConversationSummaries(
    get(guestChatStoreAtom).conversations.map((conversation) => summarizeConversation(conversation))
  )
);

const accountConversationSummariesValueAtom = atom<ConversationSummary[]>([]);
const accountConversationDetailsValueAtom = atom<Record<string, ConversationRecord>>({});
export const accountConversationSummariesAtom = atom(
  (get) => get(accountConversationSummariesValueAtom),
  (get, set, nextSummaries: ConversationSummary[]) => {
    if (nextSummaries.length === 0 || get(authSessionAtom).kind === "account") {
      set(accountConversationSummariesValueAtom, nextSummaries);
    }
  }
);
export const accountConversationDetailsAtom = atom(
  (get) => get(accountConversationDetailsValueAtom),
  (get, set, nextDetails: Record<string, ConversationRecord>) => {
    if (Object.keys(nextDetails).length === 0 || get(authSessionAtom).kind === "account") {
      set(accountConversationDetailsValueAtom, nextDetails);
    }
  }
);
export const draftPromptAtom = atom("");
export const chatStatusAtom = atom<ChatRequestStatus>("idle");

interface SessionOwnedChatErrorState {
  readonly guest: ChatRequestError | null;
  readonly account: ChatRequestError | null;
}

const emptySessionOwnedChatErrorState: SessionOwnedChatErrorState = {
  guest: null,
  account: null,
};

const chatErrorStateAtom = atom<SessionOwnedChatErrorState>(emptySessionOwnedChatErrorState);
export const chatErrorAtom = atom(
  (get) => {
    const authSession = get(authSessionAtom);
    if (authSession.kind === "account") {
      return get(chatErrorStateAtom).account;
    }

    if (authSession.kind === "guest") {
      return get(chatErrorStateAtom).guest;
    }

    return null;
  },
  (get, set, nextError: ChatRequestError | null) => {
    const authSession = get(authSessionAtom);
    if (authSession.kind === "bootstrap") {
      if (nextError === null) {
        set(chatErrorStateAtom, emptySessionOwnedChatErrorState);
      }
      return;
    }

    const currentState = get(chatErrorStateAtom);
    set(chatErrorStateAtom, {
      ...currentState,
      [authSession.kind]: nextError?.kind === "aborted" ? null : nextError,
    });
  }
);
export const guestPendingTurnAtom = atom<GuestPendingTurn | null>(null);
export const conversationListStatusAtom = atom<"idle" | "loading" | "ready">("idle");
export const conversationDetailStatusAtom = atom<"idle" | "loading" | "ready">("idle");
export const isComposingNewConversationAtom = atom(false);
const activeChatSessionScopeAtom = atom<"guest" | "account" | null>(null);

export const clearAccountConversationStateAtom = atom(null, (_get, set) => {
  set(accountConversationSummariesValueAtom, []);
  set(accountConversationDetailsValueAtom, {});
  set(accountSelectedConversationIdAtom, null);
});

export const syncChatSessionScopeAtom = atom(null, (get, set) => {
  const authSession = get(authSessionAtom);
  if (authSession.kind === "bootstrap") {
    return;
  }

  const previousScope = get(activeChatSessionScopeAtom);
  if (previousScope !== null && previousScope !== authSession.kind) {
    set(chatErrorStateAtom, emptySessionOwnedChatErrorState);
  }
  set(activeChatSessionScopeAtom, authSession.kind);

  if (authSession.kind === "guest") {
    if (get(accountConversationSummariesAtom).length > 0) {
      set(accountConversationSummariesAtom, []);
    }
    if (Object.keys(get(accountConversationDetailsAtom)).length > 0) {
      set(accountConversationDetailsAtom, {});
    }

    const guestConversations = get(guestChatStoreAtom).conversations;
    const selectedConversationId = get(selectedConversationIdAtom);
    if (
      selectedConversationId &&
      !guestConversations.some((conversation) => conversation.id === selectedConversationId)
    ) {
      set(selectedConversationIdAtom, guestConversations[0]?.id ?? null);
    } else if (!selectedConversationId && guestConversations.length > 0) {
      set(selectedConversationIdAtom, guestConversations[0].id);
    }

    if (get(isComposingNewConversationAtom)) {
      set(isComposingNewConversationAtom, false);
    }
    set(conversationListStatusAtom, "ready");
    set(conversationDetailStatusAtom, "ready");
    return;
  }

  if (get(selectedConversationIdAtom) || get(isComposingNewConversationAtom)) {
    return;
  }

  const firstAccountConversation = get(accountConversationSummariesAtom)[0];
  if (firstAccountConversation) {
    set(selectedConversationIdAtom, firstAccountConversation.id);
  }
});

export const clearTransientChatStateAtom = atom(null, (_get, set) => {
  set(chatStatusAtom, "idle");
  set(chatErrorAtom, null);
  set(guestPendingTurnAtom, null);
  set(conversationListStatusAtom, "ready");
  set(conversationDetailStatusAtom, "ready");
  set(isComposingNewConversationAtom, false);
});

export const activeConversationAtom = atom((get) => {
  const authSession = get(authSessionAtom);
  if (authSession.kind === "bootstrap") {
    return null;
  }

  const selectedConversationId = get(selectedConversationIdAtom);
  if (!selectedConversationId) {
    return null;
  }

  if (authSession.kind === "guest") {
    return (
      get(guestChatStoreAtom).conversations.find(
        (conversation) => conversation.id === selectedConversationId
      ) ?? null
    );
  }

  return get(accountConversationDetailsAtom)[selectedConversationId] ?? null;
});

function insertGuestConversationAtTop(
  currentStore: GuestChatStore,
  conversation: ConversationRecord
): GuestChatStore {
  return {
    conversations: [conversation, ...currentStore.conversations],
  };
}

export const ensureGuestConversationAtom = atom(null, (get, set, prompt?: string) => {
  const currentStore = get(guestChatStoreAtom);
  const selectedConversationId = get(guestSelectedConversationIdAtom);
  const selectedConversation = selectedConversationId
    ? currentStore.conversations.find((conversation) => conversation.id === selectedConversationId)
    : null;

  if (selectedConversation) {
    return selectedConversation;
  }

  const conversation = createEmptyConversation(prompt);
  set(guestChatStoreAtom, insertGuestConversationAtTop(currentStore, conversation));
  set(guestSelectedConversationIdAtom, conversation.id);
  return conversation;
});

export const createGuestConversationAtom = atom(null, (get, set, prompt?: string) => {
  const currentStore = get(guestChatStoreAtom);
  const conversation = createEmptyConversation(prompt);
  set(guestChatStoreAtom, insertGuestConversationAtTop(currentStore, conversation));
  set(guestSelectedConversationIdAtom, conversation.id);
  return conversation.id;
});

export const saveGuestConversationAtom = atom(
  null,
  (get, set, conversation: ConversationRecord) => {
    const store = get(guestChatStoreAtom);
    const nextConversations = store.conversations.some((item) => item.id === conversation.id)
      ? store.conversations.map((item) => (item.id === conversation.id ? conversation : item))
      : [conversation, ...store.conversations];

    const sortedSummaries = sortConversationSummaries(
      nextConversations.map((item) => summarizeConversation(item))
    );
    const reorderedConversations = sortedSummaries.flatMap((summary) => {
      const match = nextConversations.find((item) => item.id === summary.id);
      return match ? [match] : [];
    });

    set(guestChatStoreAtom, {
      conversations: reorderedConversations,
    });
    set(guestSelectedConversationIdAtom, conversation.id);
  }
);

export const deleteGuestConversationAtom = atom(null, (get, set, conversationId: string) => {
  const store = get(guestChatStoreAtom);
  const nextConversations = store.conversations.filter(
    (conversation) => conversation.id !== conversationId
  );
  const currentSelectedConversationId = get(guestSelectedConversationIdAtom);
  const nextSelectedConversationId =
    currentSelectedConversationId === conversationId
      ? (nextConversations[0]?.id ?? null)
      : currentSelectedConversationId;

  set(guestChatStoreAtom, {
    conversations: nextConversations,
  });
  set(guestSelectedConversationIdAtom, nextSelectedConversationId);
});

export const replaceAccountConversationAtom = atom(
  null,
  (get, set, conversation: ConversationRecord) => {
    if (get(authSessionAtom).kind !== "account") {
      return;
    }

    const currentDetails = get(accountConversationDetailsAtom);
    set(accountConversationDetailsValueAtom, {
      ...currentDetails,
      [conversation.id]: conversation,
    });

    const currentSummaries = get(accountConversationSummariesAtom);
    set(
      accountConversationSummariesValueAtom,
      upsertConversationSummary(currentSummaries, summarizeConversation(conversation))
    );
    set(accountSelectedConversationIdAtom, conversation.id);
  }
);

export const removeAccountConversationAtom = atom(null, (get, set, conversationId: string) => {
  const currentDetails = get(accountConversationDetailsAtom);
  const nextDetails = { ...currentDetails };
  delete nextDetails[conversationId];
  set(accountConversationDetailsValueAtom, nextDetails);

  const currentSummaries = get(accountConversationSummariesAtom);
  const nextSummaries = removeConversationSummary(currentSummaries, conversationId);
  set(accountConversationSummariesValueAtom, nextSummaries);

  if (get(accountSelectedConversationIdAtom) === conversationId) {
    set(accountSelectedConversationIdAtom, nextSummaries[0]?.id ?? null);
  }
});
