import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Oblique Study OS" },
      {
        name: "description",
        content: "Sign in to Oblique Study OS to manage your syllabus, MCQ bank and timed tests.",
      },
      { property: "og:title", content: "Sign in — Oblique Study OS" },
      {
        property: "og:description",
        content: "Sign in to Oblique Study OS to manage your syllabus, MCQ bank and timed tests.",
      },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) navigate({ to: "/" });
  }, [user, loading, navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { display_name: name || email.split("@")[0] },
          },
        });
        if (error) throw error;
        if (!data.session) toast.success("Check your email to confirm your account.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      toast.error(result.error.message ?? "Google sign-in failed");
      return;
    }
    if (result.redirected) return;
    navigate({ to: "/" });
  }

  return (
    <div className="grid min-h-screen place-items-center bg-background px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-3">
          <div className="grid size-10 place-items-center rounded-lg bg-gradient-to-br from-surface-3 to-surface ring-1 ring-border-2">
            <span className="font-mono text-accent">◈</span>
          </div>
          <div className="leading-tight">
            <p className="text-base font-semibold tracking-tight">Oblique</p>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-faint">Study OS</p>
          </div>
        </div>

        <h1 className="mt-8 text-2xl font-extrabold tracking-tight">
          {mode === "signin" ? "Welcome back." : "Build your question bank."}
        </h1>
        <p className="mt-2 text-sm text-muted">
          Your syllabus, MCQ bank, AI studio and timed tests in one workspace.
        </p>

        <form onSubmit={submit} className="mt-6 space-y-3">
          {mode === "signup" && (
            <input
              className="w-full rounded-lg border border-border bg-surface-2/60 px-3 py-2.5 text-sm placeholder:text-faint focus:border-accent/40 focus:outline-none"
              placeholder="Display name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          )}
          <input
            className="w-full rounded-lg border border-border bg-surface-2/60 px-3 py-2.5 text-sm placeholder:text-faint focus:border-accent/40 focus:outline-none"
            placeholder="you@email.com"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            className="w-full rounded-lg border border-border bg-surface-2/60 px-3 py-2.5 text-sm placeholder:text-faint focus:border-accent/40 focus:outline-none"
            placeholder="Password"
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button
            disabled={busy}
            className="w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground transition-transform hover:-translate-y-0.5 disabled:opacity-60"
          >
            {busy ? "Working…" : mode === "signin" ? "Sign in" : "Create account"}
          </button>
        </form>

        <button
          onClick={google}
          className="mt-3 w-full rounded-lg border border-border-2 bg-surface-2/60 px-4 py-2.5 text-sm font-medium transition-colors hover:bg-surface-3"
        >
          Continue with Google
        </button>

        <button
          onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          className="mt-5 w-full text-center font-mono text-[11px] text-muted transition-colors hover:text-foreground"
        >
          {mode === "signin" ? "No account? Create one →" : "Already registered? Sign in →"}
        </button>
      </div>
    </div>
  );
}
