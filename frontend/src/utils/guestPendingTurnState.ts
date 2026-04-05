import { type ChatMessage, type GuestPendingTurn } from "@/types/chat";

export type GuestPendingTurnInvalidation =
  | { readonly type: "all" }
  | { readonly type: "conversation"; readonly conversationId: string };

interface CreateGuestPendingTurnInput {
  readonly requestId: string;
  readonly prompt: string;
  readonly conversationId: string;
  readonly userMessageId: string;
  readonly baseMessages: ChatMessage[];
}

interface IsActiveGuestPendingTurnAttemptInput {
  readonly currentPendingTurn: GuestPendingTurn | null;
  readonly requestId: string;
  readonly invalidatedRequestIds: ReadonlySet<string>;
}

export function createGuestPendingTurn(input: CreateGuestPendingTurnInput): GuestPendingTurn {
  return {
    requestId: input.requestId,
    prompt: input.prompt,
    conversationId: input.conversationId,
    userMessageId: input.userMessageId,
    baseMessages: input.baseMessages,
  };
}

export function createRetryGuestPendingTurn(
  pendingTurn: GuestPendingTurn,
  requestId: string
): GuestPendingTurn {
  return createGuestPendingTurn({
    ...pendingTurn,
    requestId,
  });
}

export function shouldInvalidateGuestPendingTurn(
  pendingTurn: GuestPendingTurn | null,
  invalidation: GuestPendingTurnInvalidation
): boolean {
  if (pendingTurn === null) {
    return false;
  }

  if (invalidation.type === "all") {
    return true;
  }

  return pendingTurn.conversationId === invalidation.conversationId;
}

export function isActiveGuestPendingTurnAttempt(
  input: IsActiveGuestPendingTurnAttemptInput
): boolean {
  if (input.invalidatedRequestIds.has(input.requestId)) {
    return false;
  }

  return input.currentPendingTurn?.requestId === input.requestId;
}
