import { type LoginCredentials, type RegisterPayload } from "@/api/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getInteractivePointerClassName } from "@/lib/interactiveStyles";
import { type FormEvent, useState } from "react";

interface AuthPanelProps {
  mode: "login" | "register";
  status: "idle" | "submitting";
  onLogin: (credentials: LoginCredentials) => Promise<void>;
  onRegister: (payload: RegisterPayload) => Promise<void>;
  onSwitchMode: (nextMode: "login" | "register") => void;
}

export function AuthPanel({ mode, status, onLogin, onRegister, onSwitchMode }: AuthPanelProps) {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const isSubmitting = status === "submitting";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (mode === "register") {
      if (password !== confirmPassword) {
        window.toast({
          title: "Passwords do not match",
          description: "Please re-enter the same password twice.",
          variant: "destructive",
        });
        return;
      }

      await onRegister({ username, email, password });
      return;
    }

    await onLogin({ username, password });
  }

  return (
    <div>
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor={`${mode}-username`}>
            Username
          </label>
          <Input
            id={`${mode}-username`}
            autoComplete={mode === "login" ? "username" : "new-username"}
            disabled={isSubmitting}
            onChange={(event) => setUsername(event.target.value)}
            placeholder="spotnana-user"
            required
            value={username}
          />
        </div>

        {mode === "register" ? (
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="register-email">
              Email
            </label>
            <Input
              id="register-email"
              autoComplete="email"
              disabled={isSubmitting}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              required
              type="email"
              value={email}
            />
          </div>
        ) : null}

        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor={`${mode}-password`}>
            Password
          </label>
          <Input
            id={`${mode}-password`}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            disabled={isSubmitting}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="At least 8 characters"
            required
            type="password"
            value={password}
          />
        </div>

        {mode === "register" ? (
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="register-confirm-password">
              Confirm password
            </label>
            <Input
              id="register-confirm-password"
              autoComplete="new-password"
              disabled={isSubmitting}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder="Repeat your password"
              required
              type="password"
              value={confirmPassword}
            />
          </div>
        ) : null}

        <Button className="mt-2 w-full" disabled={isSubmitting} type="submit">
          {isSubmitting
            ? mode === "login"
              ? "Signing in..."
              : "Creating account..."
            : mode === "login"
              ? "Sign in"
              : "Create account"}
        </Button>
      </form>

      <div className="text-muted-foreground mt-4 text-center text-sm">
        {mode === "login" ? "Need an account?" : "Already have an account?"}{" "}
        <button
          className={getInteractivePointerClassName(
            "text-primary font-medium transition hover:opacity-80"
          )}
          onClick={() => onSwitchMode(mode === "login" ? "register" : "login")}
          type="button"
        >
          {mode === "login" ? "Create one" : "Sign in"}
        </button>
      </div>
    </div>
  );
}
