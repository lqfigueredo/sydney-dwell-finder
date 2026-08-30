import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { AppHeader } from "@/components/AppHeader";

export const adminCard = "rounded-[14px] border border-ink/10 bg-surface p-4";
export const adminBtn =
  "rounded-[8px] px-2.5 py-1 text-xs font-medium text-ink/70 ring-1 ring-ink/15 hover:bg-ink/5 disabled:opacity-40";
export const adminDanger =
  "rounded-[8px] px-2.5 py-1 text-xs font-medium text-red-700 ring-1 ring-red-700/25 hover:bg-red-700/5 disabled:opacity-40";
export const adminPrimary =
  "rounded-[8px] bg-brand px-2.5 py-1 text-xs font-medium text-brand-foreground hover:opacity-90 disabled:opacity-40";

const NAV: { to: string; label: string; exact?: boolean }[] = [
  { to: "/admin", label: "Dashboard", exact: true },
  { to: "/admin/moderation", label: "Moderation" },
  { to: "/admin/verification", label: "Verification" },
  { to: "/admin/users", label: "Members" },
  { to: "/admin/health", label: "System health" },
];

export function AdminStat({
  label,
  value,
  hint,
}: {
  label: string;
  value: number | string;
  hint?: string;
}) {
  return (
    <div className={adminCard}>
      <div className="text-[11px] font-medium uppercase tracking-wide text-ink/45">{label}</div>
      <div className="mt-1 font-display text-2xl font-semibold text-ink">{value}</div>
      {hint ? <div className="mt-0.5 text-xs text-ink/50">{hint}</div> : null}
    </div>
  );
}

export function StatusPill({ status }: { status: string }) {
  const tone =
    status === "approved"
      ? "bg-brand/10 text-brand"
      : status === "pending"
        ? "bg-accent/25 text-ink"
        : status === "rejected"
          ? "bg-red-700/10 text-red-700"
          : "bg-ink/10 text-ink/60";
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ${tone}`}>
      {status}
    </span>
  );
}

export function AdminDenied() {
  return (
    <div className="min-h-screen bg-canvas">
      <AppHeader />
      <div className="mx-auto max-w-[720px] px-6 py-16">
        <div className={adminCard}>
          <h1 className="font-display text-xl font-semibold">Admins only</h1>
          <p className="mt-2 text-sm text-ink/60">
            This account doesn’t have administrator access to SydHub.
          </p>
          <Link
            to="/dashboard"
            className="mt-4 inline-block rounded-[8px] bg-brand px-3.5 py-1.5 text-sm font-medium text-brand-foreground"
          >
            Back to my activity
          </Link>
        </div>
      </div>
    </div>
  );
}

export function AdminShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-canvas text-ink">
      <AppHeader />
      <main className="mx-auto max-w-[1440px] px-6 py-8">
        <h1 className="font-display text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-1 text-sm text-ink/55">{subtitle}</p>

        <nav className="mt-5 flex flex-wrap gap-2">
          {NAV.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              activeOptions={{ exact: item.exact ?? false }}
              className="rounded-[10px] px-3 py-1.5 text-sm font-medium text-ink/60 ring-1 ring-ink/15 hover:bg-ink/5 [&.active]:bg-brand [&.active]:text-brand-foreground [&.active]:ring-brand/25"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="mt-6">{children}</div>
      </main>
    </div>
  );
}
