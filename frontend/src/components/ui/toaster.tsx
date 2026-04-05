import { useEffect, useState } from "react";
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast";

export interface ToastMessage {
  id: string;
  title?: string;
  description?: string;
  variant?: "default" | "destructive";
}

const TOAST_LIMIT = 3;
const TOAST_REMOVE_DELAY = 4500;

let toastCounter = 0;
function createToastId() {
  toastCounter = (toastCounter + 1) % Number.MAX_SAFE_INTEGER;
  return toastCounter.toString();
}

const scheduledRemovals = new Map<string, number>();

function queueRemoval(toastId: string, remove: () => void) {
  if (scheduledRemovals.has(toastId)) {
    return;
  }

  const timeout = window.setTimeout(() => {
    scheduledRemovals.delete(toastId);
    remove();
  }, TOAST_REMOVE_DELAY);

  scheduledRemovals.set(toastId, timeout);
}

export function Toaster() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  useEffect(() => {
    window.toast = (message) => {
      const nextToast: ToastMessage = {
        id: createToastId(),
        ...message,
      };

      setToasts((current) => [nextToast, ...current].slice(0, TOAST_LIMIT));
      queueRemoval(nextToast.id, () => {
        setToasts((current) => current.filter((toast) => toast.id !== nextToast.id));
      });
    };

    return () => {
      for (const timeout of scheduledRemovals.values()) {
        window.clearTimeout(timeout);
      }
      scheduledRemovals.clear();
    };
  }, []);

  return (
    <ToastProvider>
      {toasts.map((toast) => (
        <Toast key={toast.id} variant={toast.variant}>
          <div className="grid gap-1">
            {toast.title ? <ToastTitle>{toast.title}</ToastTitle> : null}
            {toast.description ? <ToastDescription>{toast.description}</ToastDescription> : null}
          </div>
          <ToastClose />
        </Toast>
      ))}
      <ToastViewport />
    </ToastProvider>
  );
}

declare global {
  interface Window {
    toast: (message: Omit<ToastMessage, "id">) => void;
  }
}
