import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { AppHeader } from "@/components/AppHeader";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Log in or create an account — Tidewater Sydney" },
      {
        name: "description",
        content:
          "Sign in to Tidewater to list a Sydney property, post what you're looking for, and apply to wanted ads.",
      },
      { property: "og:title", content: "Log in or create an account — Tidewater Sydney" },
      {
        property: "og:description",
        content: "Sign in to list a Sydney property or post what you're looking for.",
      },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (user) void navigate({ to: "/dashboard" });
  }, [user, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { display_name: displayName },
          },
        });
        if (error) throw error;
        if (!data.session) {
          setSent(true);
          toast.success("Check your email to confirm your account.");
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Welcome back.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  const forgot = async () => {
    if (!email) return toast.error("Enter your email first.");
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) return toast.error(error.message);
    toast.success("Password reset link sent.");
  };

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <AppHeader />
      <main className="mx-auto grid max-w-[1440px] grid-cols-12 gap-6 px-6 py-10">
        <div className="col-span-12 lg:col-span-7">
          <div className="blueprint-grid h-full min-h-[380px] rounded-xl p-8 ring-1 ring-ink/10">
            <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-ink/40">
              Tidewater Sydney
            </p>
            <h1 className="mt-3 max-w-md font-display text-3xl font-semibold">
              One account, both sides of the market.
            </h1>
            <p className="mt-3 max-w-md text-sm text-ink/60">
              List a property, or post what you're looking for and let owners apply to you.
            </p>
            <div className="mt-8 flex flex-wrap gap-2 text-[12px]">
              <span className="rounded-full bg-accent/15 px-3 py-1 font-medium text-ink">
                Post properties
              </span>
              <span className="rounded-full bg-brand/10 px-3 py-1 font-medium text-brand">
                Post wanted ads
              </span>
              <span className="rounded-full bg-ink/5 px-3 py-1 font-medium text-ink/60">
                Apply either way
              </span>
            </div>
          </div>
        </div>

        <div className="col-span-12 lg:col-span-5">
          <div className="rounded-xl bg-canvas p-6 ring-1 ring-ink/10">
            <div className="flex rounded-[10px] bg-ink/5 p-1 ring-1 ring-ink/10">
              <button
                onClick={() => setMode("login")}
                className={`flex-1 rounded-[8px] px-3 py-1.5 text-sm font-medium ${mode === "login" ? "bg-canvas ring-1 ring-ink/10" : "text-ink/50"}`}
              >
                Log in
              </button>
              <button
                onClick={() => setMode("signup")}
                className={`flex-1 rounded-[8px] px-3 py-1.5 text-sm font-medium ${mode === "signup" ? "bg-canvas ring-1 ring-ink/10" : "text-ink/50"}`}
              >
                Create account
              </button>
            </div>

            {sent ? (
              <p className="mt-6 text-sm text-ink/70">
                We've emailed a confirmation link to <strong>{email}</strong>. Open it to finish
                creating your account.
              </p>
            ) : (
              <form onSubmit={submit} className="mt-5 space-y-3">
                {mode === "signup" && (
                  <Field
                    label="Display name"
                    value={displayName}
                    onChange={setDisplayName}
                    placeholder="Kate Walsh"
                    required
                  />
                )}
                <Field
                  label="Email"
                  type="email"
                  value={email}
                  onChange={setEmail}
                  placeholder="you@example.com"
                  required
                />
                <Field
                  label="Password"
                  type="password"
                  value={password}
                  onChange={setPassword}
                  placeholder="••••••••"
                  required
                />
                <button
                  type="submit"
                  disabled={busy}
                  className="w-full rounded-[10px] bg-brand px-4 py-2.5 text-sm font-semibold text-brand-foreground ring-1 ring-brand/25 hover:bg-brand/90 disabled:opacity-60"
                >
                  {busy ? "Working…" : mode === "signup" ? "Create account" : "Log in"}
                </button>
                {mode === "login" && (
                  <button
                    type="button"
                    onClick={forgot}
                    className="w-full text-center text-[12px] font-medium text-brand hover:text-brand/80"
                  >
                    Forgot your password?
                  </button>
                )}
              </form>
            )}

            <p className="mt-5 border-t border-ink/10 pt-4 text-[12px] text-ink/50">
              Just browsing?{" "}
              <Link to="/" className="font-medium text-brand">
                Back to the map
              </Link>
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-ink/40">
        {label}
      </span>
      <input
        type={type}
        value={value}
        required={required}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-[10px] bg-canvas px-3 py-2 text-sm ring-1 ring-ink/15 outline-none focus:ring-2 focus:ring-brand/40"
      />
    </label>
  );
}
