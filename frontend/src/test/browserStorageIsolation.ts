import { clearBrowserStorageBoundary } from "@/atoms/persistenceAdapter";

export function resetTestBrowserState(): void {
  if (typeof window === "undefined") {
    return;
  }

  clearBrowserStorageBoundary();
  window.document.body.innerHTML = "";
  window.toast = function toast() {};
}

export function withIsolatedBrowserStorage(
  run: () => void | Promise<void>
): () => Promise<void> {
  return async () => {
    resetTestBrowserState();

    try {
      await run();
    } finally {
      resetTestBrowserState();
    }
  };
}
