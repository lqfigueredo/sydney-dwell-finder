import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/hooks/use-auth";
import { getMyProfile } from "@/lib/profile.functions";

/** Shared query for "can this member publish yet?". */
export function useMyProfile() {
  const { user } = useAuth();
  const loadFn = useServerFn(getMyProfile);
  return useQuery({
    queryKey: ["my-profile", user?.id],
    enabled: !!user,
    queryFn: () => loadFn({}),
  });
}

/**
 * Blocks a posting form until the member's profile is complete
 * (photo, name, phone, ID document, plus company details for businesses).
 */
export function ProfileGate({ children }: { children: ReactNode }) {
  const profile = useMyProfile();

  if (profile.isLoading) {
    return <div className="h-40 animate-pulse rounded-[14px] bg-ink/5" />;
  }

  if (profile.data && !profile.data.complete) {
    return (
      <div className="rounded-[14px] border border-ink/10 bg-surface p-6">
        <h2 className="font-display text-xl font-semibold">Complete your profile to publish</h2>
        <p className="mt-1 max-w-[60ch] text-sm text-ink/55">
          SydHub only publishes ads from members we can identify. Add the details below and you can
          come straight back to this page.
        </p>
        <ul className="mt-4 list-disc pl-5 text-sm text-ink/70">
          {profile.data.missing.map((m) => (
            <li key={m}>{m}</li>
          ))}
        </ul>
        <Link
          to="/profile"
          className="mt-5 inline-block rounded-[10px] bg-brand px-5 py-2.5 text-sm font-semibold text-brand-foreground hover:bg-brand/90"
        >
          Go to my profile
        </Link>
      </div>
    );
  }

  return <>{children}</>;
}
