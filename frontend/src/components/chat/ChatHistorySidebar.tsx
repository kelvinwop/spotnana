import { Button } from "@/components/ui/button";
import { getInteractivePointerClassName } from "@/lib/interactiveStyles";
import { cn } from "@/lib/utils";
import { type ConversationSummary } from "@/types/chat";
import { MessageSquarePlus, Pencil, Trash2 } from "lucide-react";

interface ChatHistorySidebarProps {
  conversations: ConversationSummary[];
  sessionMode: "bootstrap" | "guest" | "account";
  hasRestoreFailure: boolean;
  onDeleteConversation: (conversationId: string) => void;
  onNewConversation: () => void;
  onRenameConversation: (conversationId: string, title: string) => void;
  onSelectConversation: (conversationId: string) => void;
  selectedConversationId: string | null;
}

function formatRelativeTimestamp(timestamp: string): string {
  const delta = Date.now() - new Date(timestamp).getTime();
  const minutes = Math.round(delta / 60000);
  if (minutes < 1) {
    return "just now";
  }
  if (minutes < 60) {
    return `${String(minutes)}m ago`;
  }
  const hours = Math.round(minutes / 60);
  if (hours < 24) {
    return `${String(hours)}h ago`;
  }
  const days = Math.round(hours / 24);
  return `${String(days)}d ago`;
}

export function ChatHistorySidebar({
  conversations,
  hasRestoreFailure,
  sessionMode,
  onDeleteConversation,
  onNewConversation,
  onRenameConversation,
  onSelectConversation,
  selectedConversationId,
}: ChatHistorySidebarProps) {
  const isAuthenticated = sessionMode === "account";
  const isBootstrapPending = sessionMode === "bootstrap" && !hasRestoreFailure;
  const isRestoreFailed = hasRestoreFailure;
  const isSessionLocked = sessionMode === "bootstrap";

  return (
    <aside className="border-border/60 bg-card flex h-full flex-col rounded-md border p-4">
      <div className="border-border/60 flex items-center justify-between gap-3 border-b pb-4">
        <div>
          <div className="text-muted-foreground text-sm font-medium">
            {isBootstrapPending
              ? "Restoring account session"
              : isRestoreFailed
                ? "Account restore failed"
                : isAuthenticated
                  ? "Account - Chats saved to your account"
                  : "Guest - Locally saved"}
          </div>
          <h2 className="mt-1 text-lg font-semibold">Chats</h2>
        </div>
        <Button
          disabled={isSessionLocked}
          onClick={onNewConversation}
          size="icon"
          type="button"
          variant="outline"
        >
          <MessageSquarePlus className="h-4 w-4" />
        </Button>
      </div>

      <div className="custom-scrollbar mt-4 max-h-[600px] flex-1 space-y-2 overflow-y-auto pr-1">
        {isBootstrapPending ? (
          <div className="border-border/60 text-muted-foreground rounded-md border border-dashed p-4 text-sm">
            Restoring your saved chats…
          </div>
        ) : isRestoreFailed ? (
          <div className="border-amber-500/40 text-muted-foreground rounded-md border border-dashed p-4 text-sm">
            We couldn’t restore your saved chats. Retry session restore or sign out before switching to guest mode.
          </div>
        ) : conversations.length === 0 ? (
          <div className="border-border/60 text-muted-foreground rounded-md border border-dashed p-4 text-sm">
            No conversations yet. Start with a travel question, policy check, or writing task.
          </div>
        ) : null}

        {conversations.map((conversation) => {
          const isSelected = conversation.id === selectedConversationId;
          return (
            <div
              key={conversation.id}
              className={cn(
                "group bg-background/40 hover:border-border/60 hover:bg-accent/60 rounded-md border border-transparent p-3 transition",
                isSelected && "border-border/70 bg-accent/80"
              )}
            >
              <button
                className={getInteractivePointerClassName("w-full text-left")}
                disabled={isSessionLocked}
                onClick={() => onSelectConversation(conversation.id)}
                type="button"
              >
                <div className="text-foreground line-clamp-2 text-sm font-medium">
                  {conversation.title}
                </div>
                <div className="text-muted-foreground mt-2 flex items-center justify-between text-xs">
                  <span>{String(conversation.messageCount)} messages</span>
                  <span>{formatRelativeTimestamp(conversation.updatedAt)}</span>
                </div>
              </button>

              <div className="mt-3 flex items-center gap-2 opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100">
                <Button
                  className="flex-1"
                  disabled={isSessionLocked}
                  onClick={() => {
                    const nextTitle = window.prompt("Rename conversation", conversation.title);
                    if (typeof nextTitle === "string") {
                      onRenameConversation(conversation.id, nextTitle);
                    }
                  }}
                  size="sm"
                  type="button"
                  variant="ghost"
                >
                  <Pencil className="h-4 w-4" />
                  Rename
                </Button>
                <Button
                  className="flex-1"
                  disabled={isSessionLocked}
                  onClick={() => onDeleteConversation(conversation.id)}
                  size="sm"
                  type="button"
                  variant="ghost"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
}
