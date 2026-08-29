import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/AppHeader";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Set a new password — Tidewater Sydney" },
      { name: "description", content: "Choose a new password for your Tidewater account." },
      { property: "og:title", content: "Set a new password — Tidewater Sydney" },
      { property: "og:description", content: "Choose a new password for your Tidewater account." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ResetPassword,
});

function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Password updated.");
    void navigate({ to: "/" });
  };

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <AppHeader />
      <main className="mx-auto max-w-md px-6 py-16">
        <h1 className="font-display text-2xl font-semibold">Set a new password</h1>
        <form onSubmit={submit} className="mt-5 space-y-3">
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="New password"
            className="w-full rounded-[10px] bg-ink/[0.04] px-3 py-2 text-sm outline-none ring-1 ring-transparent placeholder:text-ink/35 focus:ring-brand/40"
          />
          <button
            disabled={busy}
            className="w-full rounded-[10px] bg-brand px-4 py-2.5 text-sm font-semibold text-brand-foreground hover:bg-brand/90 disabled:opacity-60"
          >
            {busy ? "Saving…" : "Update password"}
          </button>
        </form>
      </main>
    </div>
  );
}
