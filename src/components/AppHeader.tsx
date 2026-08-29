import { Link, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

type Mode = "properties" | "wanted";

export function AppHeader({ mode, onMode }: { mode?: Mode; onMode?: (m: Mode) => void }) {
  const { user } = useAuth();
  const navigate = useNavigate();

  const signOut = async () => {
    await supabase.auth.signOut();
    void navigate({ to: "/" });
  };

  const tab = (m: Mode, dot: string, label: string) => {
    const cls = `flex items-center gap-2 rounded-[8px] px-3.5 py-1.5 text-sm font-medium ${
      mode === m ? "bg-canvas text-ink ring-1 ring-ink/10" : "text-ink/50"
    }`;
    const inner = (
      <>
        <span className={`size-2 rounded-full ${dot}`} />
        {label}
      </>
    );
    return onMode ? (
      <button className={cls} onClick={() => onMode(m)}>
        {inner}
      </button>
    ) : (
      <Link to="/" className={cls}>
        {inner}
      </Link>
    );
  };

  return (
    <header className="border-b border-ink/10 bg-canvas/85">
      <div className="mx-auto flex max-w-[1440px] flex-wrap items-center gap-4 px-6 py-3">
        <Link to="/" className="flex items-center gap-2.5">
          <span className="grid size-8 place-items-center rounded-[10px] bg-brand ring-1 ring-brand/20">
            <span className="font-display text-sm font-semibold text-brand-foreground">S</span>
          </span>
          <span className="font-display text-[15px] font-semibold tracking-tight">SydHub</span>
          <span className="mt-0.5 hidden text-[11px] font-medium tracking-wide text-ink/45 sm:inline">
            Sydney
          </span>
        </Link>

        <div className="ml-2 flex rounded-[10px] bg-ink/5 p-1 ring-1 ring-ink/10">
          {tab("properties", "bg-accent", "Properties")}
          {tab("wanted", "bg-brand", "Wanted")}
        </div>

        <div className="ml-auto flex items-center gap-2 text-sm">
          {user ? (
            <>
              <Link
                to="/dashboard"
                className="rounded-[8px] px-3 py-1.5 font-medium text-ink/70 hover:bg-ink/5"
              >
                My activity
              </Link>
              <button
                onClick={signOut}
                className="rounded-[8px] px-3 py-1.5 font-medium text-ink/70 hover:bg-ink/5"
              >
                Log out
              </button>
              <Link
                to="/post-listing"
                className="rounded-[8px] bg-brand px-3.5 py-1.5 font-medium text-brand-foreground ring-1 ring-brand/25 hover:bg-brand/90"
              >
                Post a property
              </Link>
            </>
          ) : (
            <>
              <Link
                to="/auth"
                className="rounded-[8px] px-3 py-1.5 font-medium text-ink/70 hover:bg-ink/5"
              >
                Log in
              </Link>
              <Link
                to="/auth"
                className="rounded-[8px] bg-brand px-3.5 py-1.5 font-medium text-brand-foreground ring-1 ring-brand/25 hover:bg-brand/90"
              >
                Create account
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
