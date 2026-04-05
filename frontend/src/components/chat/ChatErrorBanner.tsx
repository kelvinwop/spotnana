import { AlertTriangle, RotateCcw } from "lucide-react";
import { type ChatRequestError } from "@/types/chat";
import { Button } from "@/components/ui/button";

interface ChatErrorBannerProps {
  error: ChatRequestError;
  onRetry: () => Promise<void> | void;
  canRetry: boolean;
}

export function ChatErrorBanner({ error, onRetry, canRetry }: ChatErrorBannerProps) {
  return (
    <div className="rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-4 text-sm text-destructive-foreground">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="font-semibold">{error.title}</div>
          <div className="mt-1 text-destructive-foreground/90">{error.message}</div>
          {error.status ? (
            <div className="mt-2 text-xs uppercase tracking-[0.18em] text-destructive-foreground/70">
              HTTP {String(error.status)}
            </div>
          ) : null}
        </div>
        {canRetry ? (
          <Button className="shrink-0" onClick={() => void onRetry()} type="button" variant="outline">
            <RotateCcw className="h-4 w-4" />
            Retry
          </Button>
        ) : null}
      </div>
    </div>
  );
}
