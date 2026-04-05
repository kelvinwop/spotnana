interface RegisteredChatAbortController {
  readonly id: string;
  readonly controller: AbortController;
}

const activeChatAbortControllers = new Map<string, AbortController>();

export function registerChatAbortController(controller: AbortController): RegisteredChatAbortController {
  const id = crypto.randomUUID();
  activeChatAbortControllers.set(id, controller);
  return {
    id,
    controller,
  };
}

export function unregisterChatAbortController(id: string): void {
  activeChatAbortControllers.delete(id);
}

export function abortAllChatRequests(): void {
  for (const controller of activeChatAbortControllers.values()) {
    controller.abort();
  }
  activeChatAbortControllers.clear();
}
