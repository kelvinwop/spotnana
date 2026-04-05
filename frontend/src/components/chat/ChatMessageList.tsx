import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { type ChatRequestStatus, type ConversationRecord } from "@/types/chat";
import { Bot, Loader2, User2 } from "lucide-react";
import { useEffect, useRef } from "react";

interface ChatMessageListProps {
  conversation: ConversationRecord | null;
  isAuthenticated: boolean;
  isBootstrapPending: boolean;
  isRestoreFailed: boolean;
  isPageLoading: boolean;
  status: ChatRequestStatus;
}

function formatMessageTimestamp(timestamp: string): string {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

function EmptyState({
  isAuthenticated,
  isBootstrapPending,
  isRestoreFailed,
}: {
  isAuthenticated: boolean;
  isBootstrapPending: boolean;
  isRestoreFailed: boolean;
}) {
  return (
    <div className="border-border/60 bg-card/50 flex h-full min-h-[320px] flex-col items-center justify-center rounded-md border border-dashed px-8 py-16 text-center">
      <div className="bg-primary/10 text-primary mb-4 rounded-md p-4">
        <Bot className="h-8 w-8" />
      </div>
      <h3 className="text-xl font-semibold">
        {isBootstrapPending
          ? "Restoring your account"
          : isRestoreFailed
            ? "Account restore needs attention"
            : "Start a new conversation"}
      </h3>
      <p className="text-muted-foreground mt-3 max-w-xl text-sm leading-6">
        {isBootstrapPending
          ? "We’re reconnecting your saved account session before chat actions become available."
          : isRestoreFailed
            ? "We couldn’t restore your saved account session. Retry restore or sign out before guest actions become available."
            : isAuthenticated
              ? "Your next message will be saved to your account."
              : "Configure AI settings to start chatting."}
      </p>
    </div>
  );
}

function MessageListSkeleton() {
  return (
    <div className="flex min-h-[320px] flex-col gap-4">
      <div className="flex justify-start">
        <Skeleton className="h-24 w-[72%] rounded-xl" />
      </div>
      <div className="flex justify-end">
        <Skeleton className="h-20 w-[58%] rounded-xl" />
      </div>
      <div className="flex justify-start">
        <Skeleton className="h-28 w-[76%] rounded-xl" />
      </div>
    </div>
  );
}

export function ChatMessageList({
  conversation,
  isAuthenticated,
  isBootstrapPending,
  isRestoreFailed,
  isPageLoading,
  status,
}: ChatMessageListProps) {
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversation?.messages]);

  if (isPageLoading) {
    return <MessageListSkeleton />;
  }

  if (!conversation || conversation.messages.length === 0) {
    return (
      <EmptyState
        isAuthenticated={isAuthenticated}
        isBootstrapPending={isBootstrapPending}
        isRestoreFailed={isRestoreFailed}
      />
    );
  }

  return (
    <div className="custom-scrollbar flex h-full max-h-[320px] min-h-[320px] flex-col gap-4 overflow-y-auto pr-1">
      {conversation.messages.map((message) => {
        const isAssistant = message.role === "assistant";
        return (
          <div
            key={message.id}
            className={cn("flex w-full", isAssistant ? "justify-start" : "justify-end")}
          >
            <div
              className={cn(
                "max-w-[85%] rounded-md border px-4 py-3 shadow-sm sm:max-w-[70%]",
                isAssistant
                  ? "border-border/60 bg-card/90"
                  : "border-primary/30 bg-primary text-primary-foreground"
              )}
            >
              <div className="mb-3 flex items-center gap-2 text-xs tracking-[0.18em] uppercase opacity-80">
                {isAssistant ? <Bot className="h-4 w-4" /> : <User2 className="h-4 w-4" />}
                <span>{isAssistant ? "Assistant" : "You"}</span>
                <span className="text-[10px] tracking-normal opacity-80">
                  {formatMessageTimestamp(message.createdAt)}
                </span>
              </div>
              <p className="text-sm leading-6 whitespace-pre-wrap">{message.content}</p>
            </div>
          </div>
        );
      })}
      <div ref={bottomRef} />
      {status !== "idle" ? (
        <div className="flex justify-start">
          <div className="border-border/60 bg-card text-muted-foreground flex items-center gap-3 rounded-md border px-4 py-3 text-sm shadow-sm">
            <Loader2 className="h-4 w-4 animate-spin" />
            {status === "waiting_for_first_token"
              ? "Thinking…"
              : "Assistant is drafting a response…"}
          </div>
        </div>
      ) : null}
    </div>
  );
}
