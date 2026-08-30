import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { TERMS_UPDATED_AT, TERMS_VERSION, hasAcceptedCurrentTerms } from "@/lib/terms";

/**
 * Blocks the app for signed-in members who haven't accepted the current
 * Terms of Use & Privacy Policy (new members, or after a version bump).
 */
export function TermsGate() {
  const { user, loading } = useAuth();
  const [needsAccept, setNeedsAccept] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (loading) return;
    if (!user) {
      setNeedsAccept(false);
      return;
    }
    void (async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("terms_accepted_at, terms_version")
        .eq("id", user.id)
        .maybeSingle();
      if (cancelled || error) return;
      setNeedsAccept(!data || !hasAcceptedCurrentTerms(data));
    })();
    return () => {
      cancelled = true;
    };
  }, [user, loading]);

  if (!needsAccept || !user) return null;

  const accept = async () => {
    setBusy(true);
    const { error } = await supabase
      .from("profiles")
      .update({ terms_accepted_at: new Date().toISOString(), terms_version: TERMS_VERSION })
      .eq("id", user.id);
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setNeedsAccept(false);
    toast.success("Thanks — you're all set.");
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-ink/50 px-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-xl bg-canvas p-6 text-ink ring-1 ring-ink/10">
        <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-ink/40">
          Version {TERMS_VERSION} · {TERMS_UPDATED_AT}
        </p>
        <h2 className="mt-2 font-display text-xl font-semibold">
          Please accept our Terms of Use
        </h2>
        <p className="mt-3 text-sm text-ink/70">
          Before you keep using SydHub, we need you to agree to our Terms of Use and Privacy Policy.
          In short: post honestly and only content you have the right to publish, posts are
          moderated before going public, SydHub is a listing platform rather than an agency, and
          your email and verification documents are never published.
        </p>
        <a
          href="/terms"
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-block text-sm font-medium text-brand hover:text-brand/80"
        >
          Read the full Terms of Use &amp; Privacy Policy →
        </a>
        <div className="mt-5 flex flex-wrap gap-2">
          <button
            onClick={accept}
            disabled={busy}
            className="flex-1 rounded-[10px] bg-brand px-4 py-2.5 text-sm font-semibold text-brand-foreground hover:bg-brand/90 disabled:opacity-60"
          >
            {busy ? "Saving…" : "I agree"}
          </button>
          <button
            onClick={() => void supabase.auth.signOut()}
            className="rounded-[10px] px-4 py-2.5 text-sm font-medium text-ink/60 ring-1 ring-ink/15 hover:bg-ink/5"
          >
            Log out
          </button>
        </div>
      </div>
    </div>
  );
}
