import { Link, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export function AppHeader({ mode }: { mode?: "properties" | "wanted" }) {
  const { user } = useAuth();
  const navigate = useNavigate();

  const signOut = async () => {
    await supabase.auth.signOut();
    void navigate({ to: "/" });
  };

  return (
    <header className="border-b border-ink/10 bg-canvas/85">
      <div className="mx-auto flex max-w-[1440px] flex-wrap items-center gap-4 px-6 py-3">
        <Link to="/" className="flex items-center gap-2.5">
          <span className="grid size-8 place-items-center rounded-[10px] bg-brand ring-1 ring-brand/20">
            <span className="font-display text-sm font-semibold text-brand-foreground">T</span>
          </span>
          <span className="font-display text-[15px] font-semibold tracking-tight">Tidewater</span>
          <span className="mt-0.5 hidden text-[11px] font-medium tracking-wide text-ink/45 sm:inline">
            Sydney
          </span>
        </Link>

        <div className="ml-2 flex rounded-[10px] bg-ink/5 p-1 ring-1 ring-ink/10">
          <Link
            to="/"
            search={{ mode: "properties" }}
            className={`flex items-center gap-2 rounded-[8px] px-3.5 py-1.5 text-sm font-medium ${
              mode === "properties" ? "bg-canvas text-ink ring-1 ring-ink/10" : "text-ink/50"
            }`}
          >
            <span className="size-2 rounded-full bg-accent" />
            Properties
          </Link>
          <Link
            to="/"
            search={{ mode: "wanted" }}
            className={`flex items-center gap-2 rounded-[8px] px-3.5 py-1.5 text-sm font-medium ${
              mode === "wanted" ? "bg-canvas text-ink ring-1 ring-ink/10" : "text-ink/50"
            }`}
          >
            <span className="size-2 rounded-full bg-brand" />
            Wanted
          </Link>
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
                search={{ tab: "signup" }}
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
