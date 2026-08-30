import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  AdminDenied,
  AdminShell,
  StatusPill,
  adminBtn,
  adminCard,
  adminDanger,
  adminPrimary,
} from "@/components/admin/AdminShell";
import { useAdminData } from "@/hooks/use-admin-data";
import type { ModerationStatus } from "@/lib/admin.functions";
import { priceShort, propertyKindLabel } from "@/lib/marketplace";
import { ListingPhotoReview } from "@/components/admin/ListingPhotoReview";

export const Route = createFileRoute("/_authenticated/admin/moderation")({
  head: () => ({
    meta: [
      { title: "Moderation queue — SydHub Sydney" },
      {
        name: "description",
        content:
          "Approve, reject or pause Sydney property listings and wanted ads before they go live on SydHub.",
      },
      { property: "og:title", content: "Moderation queue — SydHub Sydney" },
      {
        property: "og:description",
        content: "Review submitted listings and wanted ads, with approve, reject and pause actions.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ModerationPage,
});

const STATUSES: (ModerationStatus | "all")[] = ["pending", "approved", "paused", "rejected", "all"];

function ModerationPage() {
  const { isAdmin, loading, snapshot, data, act } = useAdminData();
  const [kind, setKind] = useState<"listings" | "wanted">("listings");
  const [status, setStatus] = useState<ModerationStatus | "all">("pending");
  const [q, setQ] = useState("");

  const names = useMemo(() => {
    const m = new Map<string, string>();
    data?.profiles.forEach((p) => m.set(p.id, p.display_name || "Member"));
    return m;
  }, [data]);

  const match = (...parts: (string | null | undefined)[]) =>
    !q.trim() || parts.join(" ").toLowerCase().includes(q.trim().toLowerCase());

  if (loading) {
    return (
      <AdminShell title="Moderation queue" subtitle="Checking access…">
        <p className="text-sm text-ink/50">One moment…</p>
      </AdminShell>
    );
  }
  if (!isAdmin) return <AdminDenied />;

  const listings = (data?.listings ?? []).filter(
    (l) =>
      (status === "all" || l.moderation_status === status) &&
      match(l.title, l.suburb, names.get(l.owner_id ?? "")),
  );
  const wanted = (data?.wanted ?? []).filter(
    (w) =>
      (status === "all" || w.moderation_status === status) &&
      match(w.title, (w.suburbs ?? []).join(" "), names.get(w.seeker_id ?? "")),
  );

  const moderate = (
    target: "listing" | "wanted",
    id: string,
    next: ModerationStatus,
    title: string,
  ) => {
    let reason: string | undefined;
    if (next === "rejected") {
      const input = prompt(`Why is “${title}” being rejected? (shown to the author)`);
      if (input === null) return;
      reason = input.trim() || undefined;
    }
    act.mutate(
      target === "listing"
        ? { kind: "listing.moderate", id, status: next, reason }
        : { kind: "wanted.moderate", id, status: next, reason },
    );
  };

  const counts = (rows: { moderation_status: string }[], s: string) =>
    s === "all" ? rows.length : rows.filter((r) => r.moderation_status === s).length;

  const source = kind === "listings" ? (data?.listings ?? []) : (data?.wanted ?? []);

  return (
    <AdminShell
      title="Moderation queue"
      subtitle="Approve, reject or pause submissions before they appear publicly."
    >
      <div className="flex flex-wrap items-center gap-2">
        {(["listings", "wanted"] as const).map((k) => (
          <button
            key={k}
            onClick={() => setKind(k)}
            className={`rounded-[10px] px-3 py-1.5 text-sm font-medium ring-1 ${
              kind === k
                ? "bg-ink text-canvas ring-ink/20"
                : "text-ink/60 ring-ink/15 hover:bg-ink/5"
            }`}
          >
            {k === "listings" ? "Listings" : "Wanted ads"}
          </button>
        ))}
        <span className="mx-1 h-5 w-px bg-ink/10" />
        {STATUSES.map((s) => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            className={`rounded-[10px] px-3 py-1.5 text-sm font-medium capitalize ring-1 ${
              status === s
                ? "bg-brand text-brand-foreground ring-brand/25"
                : "text-ink/60 ring-ink/15 hover:bg-ink/5"
            }`}
          >
            {s} <span className="opacity-60">{counts(source, s)}</span>
          </button>
        ))}
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search…"
          className="ml-auto w-56 rounded-[10px] border border-ink/15 bg-surface px-3 py-1.5 text-sm outline-none focus:border-brand"
        />
      </div>

      {snapshot.isLoading ? (
        <p className="mt-6 text-sm text-ink/50">Loading queue…</p>
      ) : snapshot.error ? (
        <p className="mt-6 text-sm text-red-700">{(snapshot.error as Error).message}</p>
      ) : (
        <div className="mt-4 space-y-3">
          {kind === "listings" &&
            (listings.length === 0 ? (
              <p className={`${adminCard} text-sm text-ink/50`}>Nothing here.</p>
            ) : (
              listings.map((l) => (
                <article key={l.id} className={`${adminCard} flex flex-wrap items-start gap-4`}>
                  <div className="min-w-[220px] flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        to="/listings/$id"
                        params={{ id: l.id }}
                        className="font-medium hover:underline"
                      >
                        {l.title}
                      </Link>
                      <StatusPill status={l.moderation_status} />
                    </div>
                    <div className="mt-0.5 text-xs text-ink/50">
                      {propertyKindLabel(l.property_type)} · {l.suburb} · {l.bedrooms} bed ·{" "}
                      {priceShort(l.deal, l.price_cents)}
                    </div>
                    <div className="mt-0.5 text-xs text-ink/45">
                      {names.get(l.owner_id ?? "") ?? "Unknown owner"} ·{" "}
                      {new Date(l.created_at).toLocaleDateString("en-AU")}
                      {l.lat == null || l.lng == null ? " · no map pin" : ""}
                    </div>
                    {l.rejection_reason ? (
                      <div className="mt-1 text-xs text-red-700">Reason: {l.rejection_reason}</div>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      className={adminPrimary}
                      disabled={l.moderation_status === "approved"}
                      onClick={() => moderate("listing", l.id, "approved", l.title)}
                    >
                      Approve
                    </button>
                    <button
                      className={adminBtn}
                      disabled={l.moderation_status === "paused"}
                      onClick={() => moderate("listing", l.id, "paused", l.title)}
                    >
                      Pause
                    </button>
                    <button
                      className={adminDanger}
                      disabled={l.moderation_status === "rejected"}
                      onClick={() => moderate("listing", l.id, "rejected", l.title)}
                    >
                      Reject
                    </button>
                    <button
                      className={adminDanger}
                      onClick={() => {
                        if (confirm(`Delete “${l.title}”?`))
                          act.mutate({ kind: "listing.delete", id: l.id });
                      }}
                    >
                      Delete
                    </button>
                  </div>
                  <ListingPhotoReview
                    listingId={l.id}
                    onRemove={(photoId, reason) =>
                      act.mutate({
                        kind: "photo.remove",
                        id: photoId,
                        listingId: l.id,
                        reason: reason || undefined,
                      })
                    }
                  />
                </article>
              ))
            ))}

          {kind === "wanted" &&
            (wanted.length === 0 ? (
              <p className={`${adminCard} text-sm text-ink/50`}>Nothing here.</p>
            ) : (
              wanted.map((w) => (
                <article key={w.id} className={`${adminCard} flex flex-wrap items-start gap-4`}>
                  <div className="min-w-[220px] flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        to="/wanted/$id"
                        params={{ id: w.id }}
                        className="font-medium hover:underline"
                      >
                        {w.title}
                      </Link>
                      <StatusPill status={w.moderation_status} />
                      {!w.open ? (
                        <span className="rounded-full bg-ink/10 px-2 py-0.5 text-[11px] text-ink/60">
                          Closed
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-0.5 text-xs text-ink/50">
                      {(w.suburbs ?? []).join(", ") || "No suburbs"} · {w.bedrooms_min}+ bed ·{" "}
                      {priceShort(w.deal, w.budget_cents)}
                    </div>
                    <div className="mt-0.5 text-xs text-ink/45">
                      {names.get(w.seeker_id ?? "") ?? "Unknown member"} ·{" "}
                      {new Date(w.created_at).toLocaleDateString("en-AU")}
                    </div>
                    {w.rejection_reason ? (
                      <div className="mt-1 text-xs text-red-700">Reason: {w.rejection_reason}</div>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      className={adminPrimary}
                      disabled={w.moderation_status === "approved"}
                      onClick={() => moderate("wanted", w.id, "approved", w.title)}
                    >
                      Approve
                    </button>
                    <button
                      className={adminBtn}
                      disabled={w.moderation_status === "paused"}
                      onClick={() => moderate("wanted", w.id, "paused", w.title)}
                    >
                      Pause
                    </button>
                    <button
                      className={adminDanger}
                      disabled={w.moderation_status === "rejected"}
                      onClick={() => moderate("wanted", w.id, "rejected", w.title)}
                    >
                      Reject
                    </button>
                    <button
                      className={adminBtn}
                      onClick={() => act.mutate({ kind: "wanted.open", id: w.id, value: !w.open })}
                    >
                      {w.open ? "Close" : "Reopen"}
                    </button>
                    <button
                      className={adminDanger}
                      onClick={() => {
                        if (confirm(`Delete “${w.title}”?`))
                          act.mutate({ kind: "wanted.delete", id: w.id });
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </article>
              ))
            ))}
        </div>
      )}
    </AdminShell>
  );
}
