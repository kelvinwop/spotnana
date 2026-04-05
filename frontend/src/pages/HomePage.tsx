import { Link } from "react-router-dom";
import { ArrowRight, Bot, Database, MessageSquare, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const featureCards = [
  {
    icon: MessageSquare,
    title: "Guest first",
    description: "Open the workspace, add your own key, and start a conversation without creating an account first.",
  },
  {
    icon: Database,
    title: "Account sync when you need it",
    description: "Sign in later to keep new conversations and AI preferences available across devices.",
  },
  {
    icon: ShieldCheck,
    title: "BYOK stays explicit",
    description: "Use your own OpenAI or OpenRouter key while the backend keeps request handling and history storage consistent.",
  },
] as const;

const previewMessages = [
  {
    role: "You",
    body: "Summarize this trip disruption update for an agent and list the next actions.",
  },
  {
    role: "Assistant",
    body: "I can turn that into a passenger-facing summary, an internal handoff note, or a step-by-step recovery checklist.",
  },
] as const;

export function HomePage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-4 py-6 sm:px-6 lg:px-8">
        <header className="flex items-center justify-between gap-4 border-b border-border/60 py-4">
          <div>
            <div className="text-xs font-medium uppercase tracking-[0.24em] text-muted-foreground">Spotnana</div>
            <div className="mt-2 text-xl font-semibold">AI workspace</div>
          </div>
          <Button asChild>
            <Link to="/chat">
              Open chat
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </header>

        <main className="grid flex-1 gap-14 py-12 lg:grid-cols-[1.05fr_0.95fr] lg:items-start">
          <section className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-muted/50 px-3 py-1 text-xs font-medium uppercase tracking-[0.24em] text-muted-foreground">
              <Bot className="h-3.5 w-3.5 text-primary" />
              Focused chat for travel operations work
            </div>
            <h1 className="mt-6 text-4xl font-semibold tracking-tight sm:text-6xl">
              A cleaner AI chat workspace for drafting, summarizing, and decision support.
            </h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-muted-foreground sm:text-lg">
              Spotnana keeps the product simple: conversation history, bring-your-own AI settings, and a clear path from guest use to account-backed chat sync.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link to="/chat">
                  Start in chat
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link to="/chat">Review the workspace</Link>
              </Button>
            </div>

            <div className="mt-10 grid gap-4 sm:grid-cols-3">
              {featureCards.map((feature) => {
                const Icon = feature.icon;
                return (
                  <Card key={feature.title} className="h-full">
                    <CardHeader className="pb-4">
                      <div className="mb-2 inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <Icon className="h-4 w-4" />
                      </div>
                      <CardTitle className="text-base">{feature.title}</CardTitle>
                      <CardDescription>{feature.description}</CardDescription>
                    </CardHeader>
                  </Card>
                );
              })}
            </div>
          </section>

          <section className="space-y-4">
            <Card>
              <CardHeader className="border-b border-border/60 pb-5">
                <div className="text-xs font-medium uppercase tracking-[0.24em] text-muted-foreground">Product preview</div>
                <CardTitle className="text-2xl">The chat surface, without the clutter</CardTitle>
                <CardDescription>
                  Open the workspace to manage AI settings, browse history, and keep the main canvas centered on the conversation itself.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-xl border border-border/60 bg-background/50 p-4">
                  <div className="flex items-center justify-between gap-3 border-b border-border/60 pb-3">
                    <div>
                      <div className="text-sm font-medium">Workspace shell</div>
                      <div className="mt-1 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                        History · Conversation · Settings
                      </div>
                    </div>
                    <div className="rounded-lg border border-border/60 px-3 py-1 text-xs text-muted-foreground">
                      Guest mode
                    </div>
                  </div>
                  <div className="mt-4 space-y-3">
                    {previewMessages.map((message) => (
                      <div
                        key={`${message.role}-${message.body}`}
                        className="rounded-xl border border-border/60 bg-card/80 px-4 py-3"
                      >
                        <div className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                          {message.role}
                        </div>
                        <p className="mt-2 text-sm leading-6 text-foreground">{message.body}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-border/60 bg-background/40 p-4">
                    <div className="text-sm font-medium">Guest persistence</div>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      Local conversation history and AI settings are available immediately.
                    </p>
                  </div>
                  <div className="rounded-xl border border-border/60 bg-background/40 p-4">
                    <div className="text-sm font-medium">Intentional auth</div>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      Sign-in moves into a focused dialog instead of occupying the main workspace.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>
        </main>
      </div>
    </div>
  );
}
