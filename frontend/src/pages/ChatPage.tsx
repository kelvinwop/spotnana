import { useState } from "react";
import { LogOut, Settings2, UserRound } from "lucide-react";
import { AuthPanel } from "@/components/chat/AuthPanel";
import { ChatComposer } from "@/components/chat/ChatComposer";
import { ChatErrorBanner } from "@/components/chat/ChatErrorBanner";
import { ChatHistorySidebar } from "@/components/chat/ChatHistorySidebar";
import { ChatMessageList } from "@/components/chat/ChatMessageList";
import { SavedAiSettingsPanel } from "@/components/chat/SavedAiSettingsPanel";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { useAuth } from "@/hooks/useAuth";
import { useChatApp } from "@/hooks/useChatApp";

export function ChatPage() {
  const {
    activeConversation,
    authSession,
    chatError,
    chatStatus,
    clearAllGuestConversations,
    conversationDetailStatus,
    conversationListStatus,
    conversationSummaries,
    deleteConversation,
    draftPrompt,
    hasStoredAccountApiKey,
    isAuthenticated,
    isAuthBootstrapPending,
    renameConversation,
    clearDraftPrompt,
    retryLastPrompt,
    retryPrompt,
    selectedConversationId,
    setDraftPrompt,
    setSelectedConversationId,
    startNewConversation,
    submitDisabledReason,
    submitPrompt,
  } = useChatApp();
  const { isAuthRestoreFailed, login, logout, register, user } = useAuth();
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const settingsReady = isAuthBootstrapPending || isAuthRestoreFailed
    ? false
    : isAuthenticated
      ? hasStoredAccountApiKey
      : !submitDisabledReason;
  const [authPanelStatus, setAuthPanelStatus] = useState<"idle" | "submitting">("idle");
  const [isAuthDialogOpen, setIsAuthDialogOpen] = useState(false);
  const [isAiSettingsDialogOpen, setIsAiSettingsDialogOpen] = useState(false);


  async function handleLogin(credentials: Parameters<typeof login>[0]) {
    setAuthPanelStatus("submitting");
    try {
      await login(credentials);
      setIsAuthDialogOpen(false);
    } catch (error) {
      window.toast({
        title: "Sign-in failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setAuthPanelStatus("idle");
    }
  }

  async function handleRegister(payload: Parameters<typeof register>[0]) {
    setAuthPanelStatus("submitting");
    try {
      await register(payload);
      setIsAuthDialogOpen(false);
    } catch (error) {
      window.toast({
        title: "Registration failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setAuthPanelStatus("idle");
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-4 sm:px-6 lg:px-8">
        <header className="border-b border-border/60 pb-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-xl font-semibold tracking-tight">AI Chat Demo</h1>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {isAuthenticated ? (
                <div className="flex items-center gap-2 rounded-md border border-border/60 bg-card px-3 py-2 text-sm text-muted-foreground">
                  <UserRound className="h-4 w-4 text-primary" />
                  <span className="font-medium text-foreground">{user ? user.username : "Account"}</span>
                  <Button onClick={() => void logout()} size="sm" type="button" variant="ghost">
                    <LogOut className="h-4 w-4" />
                    Sign out
                  </Button>
                </div>
              ) : isAuthRestoreFailed ? (
                <div className="flex items-center gap-2 rounded-md border border-amber-500/40 bg-card px-3 py-2 text-sm text-muted-foreground">
                  <UserRound className="h-4 w-4 text-amber-300" />
                  <span className="font-medium text-foreground">Restore failed</span>
                  <Button onClick={() => void logout()} size="sm" type="button" variant="ghost">
                    <LogOut className="h-4 w-4" />
                    Sign out
                  </Button>
                </div>
              ) : isAuthBootstrapPending ? (
                <div className="flex items-center gap-2 rounded-md border border-border/60 bg-card px-3 py-2 text-sm text-muted-foreground">
                  <UserRound className="h-4 w-4 text-primary" />
                  <span className="font-medium text-foreground">Restoring account…</span>
                </div>
              ) : (
                <Button onClick={() => setIsAuthDialogOpen(true)} type="button" variant="outline">
                  <UserRound className="h-4 w-4" />
                  Sign in
                </Button>
              )}
            </div>
          </div>
        </header>

        <div className="grid flex-1 gap-4 py-4 lg:grid-cols-[280px_minmax(0,1fr)]">
          <div className="order-2 lg:order-1">
            <ChatHistorySidebar
              conversations={conversationSummaries}
              hasRestoreFailure={isAuthRestoreFailed}
              sessionMode={authSession.kind}
              onDeleteConversation={(conversationId) => void deleteConversation(conversationId)}
              onNewConversation={startNewConversation}
              onRenameConversation={(conversationId, title) =>
                void renameConversation(conversationId, title)
              }
              onSelectConversation={setSelectedConversationId}
              selectedConversationId={selectedConversationId}
            />
            {conversationListStatus === "loading" ? (
              <div className="mt-3 rounded-md border border-border/60 bg-card/70 px-4 py-3 text-sm text-muted-foreground">
                Loading history…
              </div>
            ) : null}
          </div>

          <section className="order-1 flex min-h-[72vh] flex-col gap-4 lg:order-2">
            <div className="flex min-h-0 flex-1 flex-col rounded-md border border-border/60 bg-card p-4 sm:p-5">
              <div className="mb-4 flex items-center justify-between gap-3 border-b border-border/60 pb-4">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-foreground">
                    {activeConversation ? activeConversation.title : "New chat"}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {!isAuthenticated && !isAuthBootstrapPending && !isAuthRestoreFailed && conversationSummaries.length > 0 ? (
                    <Button onClick={clearAllGuestConversations} type="button" variant="ghost">
                      Clear guest chats
                    </Button>
                  ) : null}
                  <Button disabled={isAuthBootstrapPending || isAuthRestoreFailed} onClick={startNewConversation} type="button" variant="outline">
                    New chat
                  </Button>
                  {isAuthBootstrapPending || isAuthRestoreFailed ? null : (
                    <Button
                      onClick={() => setIsAiSettingsDialogOpen(true)}
                      size="icon"
                      type="button"
                      variant="outline"
                    >
                      <Settings2 className="h-4 w-4" />
                      <span className="sr-only">Open AI settings</span>
                    </Button>
                  )}
                </div>
              </div>

              <ChatMessageList
                conversation={activeConversation}
                isAuthenticated={isAuthenticated}
                isBootstrapPending={isAuthBootstrapPending}
                isPageLoading={conversationDetailStatus === "loading"}
                isRestoreFailed={isAuthRestoreFailed}
                status={chatStatus}
              />
            </div>

            <ChatComposer
              draftPrompt={draftPrompt}
              isBootstrapPending={isAuthBootstrapPending}
              isRestoreFailed={isAuthRestoreFailed}
              onChange={setDraftPrompt}
              onClearConversation={clearDraftPrompt}
              onOpenSettings={() => setIsAiSettingsDialogOpen(true)}
              onSubmit={submitPrompt}
              settingsReady={settingsReady}
              status={chatStatus}
              submitDisabledReason={submitDisabledReason}
            />

            {chatError ? (
              <ChatErrorBanner
                canRetry={Boolean(retryPrompt)}
                error={chatError}
                onRetry={retryLastPrompt}
              />
            ) : null}
          </section>
        </div>
      </div>

      <Dialog
        description={
          authMode === "login"
            ? "Sign in to save chats and settings."
            : "Create an account to save chats and settings."
        }
        onOpenChange={(nextOpen) => {
          setIsAuthDialogOpen(nextOpen);
          if (nextOpen) {
            return;
          }
          setAuthMode("login");
        }}
        open={isAuthDialogOpen}
        title={authMode === "login" ? "Sign in" : "Create account"}
      >
        <AuthPanel
          mode={authMode}
          onLogin={handleLogin}
          onRegister={handleRegister}
          onSwitchMode={setAuthMode}
          status={authPanelStatus}
        />
      </Dialog>

      <Dialog
        description={
          isAuthRestoreFailed
            ? "Saved account settings are locked until the account session is restored or signed out."
            : isAuthBootstrapPending
              ? "Wait for your saved account session to finish restoring before editing settings."
              : "Choose your provider, model, and API key."
        }
        onOpenChange={setIsAiSettingsDialogOpen}
        open={isAiSettingsDialogOpen}
        title="AI settings"
      >
        <SavedAiSettingsPanel onSaveSuccess={() => setIsAiSettingsDialogOpen(false)} />
      </Dialog>
    </div>
  );
}
