import { Button } from "@/components/ui/button";
import { type ChatRequestStatus } from "@/types/chat";
import { ArrowUpRight, Eraser, Loader2 } from "lucide-react";
import { type KeyboardEvent } from "react";

interface ChatComposerProps {
  draftPrompt: string;
  status: ChatRequestStatus;
  submitDisabledReason?: string;
  settingsReady: boolean;
  isBootstrapPending: boolean;
  isRestoreFailed: boolean;
  onChange: (value: string) => void;
  onSubmit: () => Promise<void> | void;
  onClearConversation: () => void;
  onOpenSettings: () => void;
}

export function ChatComposer({
  draftPrompt,
  status,
  submitDisabledReason,
  settingsReady,
  isBootstrapPending,
  isRestoreFailed,
  onChange,
  onSubmit,
  onClearConversation,
  onOpenSettings,
}: ChatComposerProps) {
  const isSending = status !== "idle";
  const isSubmitBlocked =
    draftPrompt.trim().length === 0 || isSending || Boolean(submitDisabledReason) || isBootstrapPending;
  const submitLabel =
    status === "waiting_for_first_token"
      ? "Waiting for first token..."
      : isSending
        ? "Thinking..."
        : "Send";

  function handleSubmit() {
    if (isSubmitBlocked) {
      return;
    }

    void onSubmit();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSubmit();
    }
  }

  return (
    <div className="border-border/60 bg-card rounded-md border p-4">
      <div className="border-border/60 mb-3 flex items-center justify-between gap-3 border-b pb-3">
        <div>
          <div className="text-sm font-medium">Compose</div>
        </div>
      </div>
      <div className="relative">
        <textarea
          className="custom-scrollbar text-foreground placeholder:text-muted-foreground min-h-[110px] w-full resize-none bg-transparent text-sm leading-6 outline-none disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isSending || !settingsReady}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask for an itinerary summary, compare supplier policies, or draft a customer-facing response..."
          value={draftPrompt}
        />
        {!settingsReady ? (
          <div className="bg-background/75 absolute inset-0 flex items-center justify-center rounded-md backdrop-blur-sm">
            <div className="flex flex-col items-center gap-3 px-4 text-center">
              <div className="text-foreground text-sm font-medium">
                {isBootstrapPending
                  ? "Restoring your saved account session…"
                  : isRestoreFailed
                    ? "We couldn’t restore your saved account session. Sign out or retry restore before guest chat can resume."
                    : "Configure AI settings to start chatting."}
              </div>
              {isBootstrapPending || isRestoreFailed ? null : (
                <Button onClick={onOpenSettings} type="button" variant="outline">
                  Open AI settings
                </Button>
              )}
            </div>
          </div>
        ) : null}
      </div>

      <div className="border-border/60 mt-4 flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-muted-foreground text-sm">
          {submitDisabledReason ?? (
            <>
              Press <span className="text-foreground font-medium">Enter</span> to send, or &nbsp;
              <span className="text-foreground font-medium">Shift+Enter</span> for a new line.
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            disabled={isSending || !settingsReady || isBootstrapPending || isRestoreFailed}
            onClick={onClearConversation}
            type="button"
            variant="ghost"
          >
            <Eraser className="h-4 w-4" />
            Clear
          </Button>
          <Button disabled={isSubmitBlocked || !settingsReady} onClick={handleSubmit} type="button">
            {isSending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ArrowUpRight className="h-4 w-4" />
            )}
            {submitLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
