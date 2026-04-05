import {
  registerChatAbortController,
  unregisterChatAbortController,
} from "@/utils/chatRequestRegistry";

interface ManagedChatRequestSignal {
  readonly signal: AbortSignal;
  dispose: () => void;
}

export function createManagedChatRequestSignal(
  upstreamSignal?: AbortSignal
): ManagedChatRequestSignal {
  const controller = new AbortController();
  const registration = registerChatAbortController(controller);

  const abortFromUpstream = () => {
    controller.abort();
  };

  if (upstreamSignal) {
    if (upstreamSignal.aborted) {
      controller.abort();
    } else {
      upstreamSignal.addEventListener("abort", abortFromUpstream, { once: true });
    }
  }

  return {
    signal: controller.signal,
    dispose: () => {
      upstreamSignal?.removeEventListener("abort", abortFromUpstream);
      unregisterChatAbortController(registration.id);
    },
  };
}
