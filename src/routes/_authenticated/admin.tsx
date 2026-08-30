import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AppHeader } from "@/components/AppHeader";
import { useAuth } from "@/hooks/use-auth";
import { useIsAdmin } from "@/hooks/use-is-admin";
import { getAdminSnapshot, runAdminAction } from "@/lib/admin.functions";
import { priceShort, propertyKindLabel } from "@/lib/marketplace";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Admin console — SydHub Sydney" },
      {
        name: "description",
        content:
          "Moderate SydHub: review Sydney property listings, wanted ads, applications, comments and member accounts.",
      },
      { property: "og:title", content: "Admin console — SydHub Sydney" },
      {
        property: "og:description",
        content: "Marketplace health, moderation tools and member roles for SydHub Sydney.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminPage,
});

type Tab = "listings" | "wanted" | "users" | "applications" | "comments";

const card = "rounded-[14px] border border-ink/10 bg-surface p-4";
const btn =
  "rounded-[8px] px-2.5 py-1 text-xs font-medium text-ink/70 ring-1 ring-ink/15 hover:bg-ink/5";
const danger =
  "rounded-[8px] px-2.5 py-1 text-xs font-medium text-red-700 ring-1 ring-red-700/25 hover:bg-red-700/5";

function Stat({ label, value, hint }: { label: string; value: number | string; hint?: string }) {
  return (
    <div className={card}>
      <div className="text-[11px] font-medium uppercase tracking-wide text-ink/45">{label}</div>
      <div className="mt-1 font-display text-2xl font-semibold text-ink">{value}</div>
      {hint ? <div className="mt-0.5 text-xs text-ink/50">{hint}</div> : null}
    </div>
  );
}

function AdminPage() {
  const { user } = useAuth();
  const { isAdmin, loading } = useIsAdmin();
  const qc = useQueryClient();
  const snapshotFn = useServerFn(getAdminSnapshot);
  const actionFn = useServerFn(runAdminAction);

  const [tab, setTab] = useState<Tab>("listings");
  const [q, setQ] = useState("");

  const snapshot = useQuery({
    queryKey: ["admin-snapshot"],
    enabled: isAdmin,
    queryFn: () => snapshotFn({}),
  });

  const act = useMutation({
    mutationFn: (input: Parameters<typeof actionFn>[0]["data"]) => actionFn({ data: input }),
    onSuccess: () => {
      toast.success("Done");
      void qc.invalidateQueries({ queryKey: ["admin-snapshot"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const d = snapshot.data;

  const names = useMemo(() => {
    const m = new Map<string, string>();
    d?.profiles.forEach((p) => m.set(p.id, p.display_name || "Member"));
    return m;
  }, [d]);

  const adminIds = useMemo(
    () => new Set((d?.roles ?? []).filter((r) => r.role === "admin").map((r) => r.user_id)),
    [d],
  );

  const stats = useMemo(() => {
    if (!d) return null;
    const week = Date.now() - 7 * 864e5;
    const recent = (rows: { created_at: string }[]) =>
      rows.filter((r) => new Date(r.created_at).getTime() > week).length;
    const photoListingIds = new Set(d.photos.map((p) => p.listing_id));
    return {
      listings: d.listings.length,
      published: d.listings.filter((l) => l.published).length,
      wanted: d.wanted.length,
      openWanted: d.wanted.filter((w) => w.open).length,
      users: d.profiles.length,
      applications: d.applications.length,
      pending: d.applications.filter((a) => a.status === "pending").length,
      accepted: d.applications.filter((a) => a.status === "accepted").length,
      declined: d.applications.filter((a) => a.status === "declined").length,
      comments: d.comments.length,
      photos: d.photos.length,
      newThisWeek:
        recent(d.listings) + recent(d.wanted) + recent(d.profiles) + recent(d.applications),
      noLocation: d.listings.filter((l) => l.lat == null || l.lng == null).length,
      noPhotos: d.listings.filter((l) => !l.cover_url && !photoListingIds.has(l.id)).length,
      noSuburbs: d.wanted.filter((w) => (w.suburbs ?? []).length === 0).length,
    };
  }, [d]);

  const match = (...parts: (string | null | undefined)[]) =>
    !q.trim() || parts.join(" ").toLowerCase().includes(q.trim().toLowerCase());

  if (loading) {
    return (
      <div className="min-h-screen bg-canvas">
        <AppHeader />
        <div className="mx-auto max-w-[1440px] px-6 py-12 text-sm text-ink/50">Checking access…</div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-canvas">
        <AppHeader />
        <div className="mx-auto max-w-[720px] px-6 py-16">
          <div className={card}>
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

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: "listings", label: "Listings", count: d?.listings.length ?? 0 },
    { key: "wanted", label: "Wanted ads", count: d?.wanted.length ?? 0 },
    { key: "users", label: "Members", count: d?.profiles.length ?? 0 },
    { key: "applications", label: "Applications", count: d?.applications.length ?? 0 },
    { key: "comments", label: "Comments", count: d?.comments.length ?? 0 },
  ];

  return (
    <div className="min-h-screen bg-canvas">
      <AppHeader />
      <main className="mx-auto max-w-[1440px] px-6 py-8">
        <h1 className="font-display text-2xl font-semibold tracking-tight">Admin console</h1>
        <p className="mt-1 text-sm text-ink/55">
          Marketplace health, moderation and member roles.
        </p>

        {snapshot.isLoading ? (
          <p className="mt-8 text-sm text-ink/50">Loading marketplace data…</p>
        ) : snapshot.error ? (
          <p className="mt-8 text-sm text-red-700">{(snapshot.error as Error).message}</p>
        ) : (
          <>
            <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Stat
                label="Properties"
                value={stats!.listings}
                hint={`${stats!.published} published · ${stats!.listings - stats!.published} hidden`}
              />
              <Stat
                label="Wanted ads"
                value={stats!.wanted}
                hint={`${stats!.openWanted} open · ${stats!.wanted - stats!.openWanted} closed`}
              />
              <Stat label="Members" value={stats!.users} hint={`${adminIds.size} admin(s)`} />
              <Stat
                label="Applications"
                value={stats!.applications}
                hint={`${stats!.pending} pending · ${stats!.accepted} accepted · ${stats!.declined} declined`}
              />
              <Stat label="Comments" value={stats!.comments} />
              <Stat label="Photos uploaded" value={stats!.photos} />
              <Stat label="New in last 7 days" value={stats!.newThisWeek} hint="across all types" />
              <Stat
                label="Needs attention"
                value={stats!.noLocation + stats!.noPhotos + stats!.noSuburbs}
                hint={`${stats!.noLocation} without a map pin · ${stats!.noPhotos} without photos · ${stats!.noSuburbs} ads without suburbs`}
              />
            </section>

            <div className="mt-8 flex flex-wrap items-center gap-2">
              {tabs.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={`rounded-[10px] px-3 py-1.5 text-sm font-medium ring-1 ${
                    tab === t.key
                      ? "bg-brand text-brand-foreground ring-brand/25"
                      : "text-ink/60 ring-ink/15 hover:bg-ink/5"
                  }`}
                >
                  {t.label} <span className="opacity-60">{t.count}</span>
                </button>
              ))}
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search…"
                className="ml-auto w-56 rounded-[10px] border border-ink/15 bg-surface px-3 py-1.5 text-sm outline-none focus:border-brand"
              />
            </div>

            <div className="mt-4 overflow-x-auto rounded-[14px] border border-ink/10 bg-surface">
              <table className="w-full min-w-[760px] text-left text-sm">
                <tbody className="divide-y divide-ink/8">
                  {tab === "listings" &&
                    d!.listings
                      .filter((l) => match(l.title, l.suburb, names.get(l.owner_id ?? "")))
                      .map((l) => (
                        <tr key={l.id}>
                          <td className="px-4 py-3">
                            <Link
                              to="/listings/$id"
                              params={{ id: l.id }}
                              className="font-medium hover:underline"
                            >
                              {l.title}
                            </Link>
                            <div className="text-xs text-ink/50">
                              {propertyKindLabel(l.property_type)} · {l.suburb} · {l.bedrooms} bed ·{" "}
                              {priceShort(l.deal, l.price_cents)}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-xs text-ink/55">
                            {names.get(l.owner_id ?? "") ?? "—"}
                            <div>{new Date(l.created_at).toLocaleDateString("en-AU")}</div>
                          </td>
                          <td className="px-4 py-3 text-xs">
                            <span
                              className={`rounded-full px-2 py-0.5 ${l.published ? "bg-brand/10 text-brand" : "bg-ink/10 text-ink/60"}`}
                            >
                              {l.published ? "Published" : "Hidden"}
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-right">
                            <button
                              className={btn}
                              onClick={() =>
                                act.mutate({
                                  kind: "listing.publish",
                                  id: l.id,
                                  value: !l.published,
                                })
                              }
                            >
                              {l.published ? "Unpublish" : "Publish"}
                            </button>{" "}
                            <button
                              className={danger}
                              onClick={() => {
                                if (confirm(`Delete “${l.title}”?`))
                                  act.mutate({ kind: "listing.delete", id: l.id });
                              }}
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))}

                  {tab === "wanted" &&
                    d!.wanted
                      .filter((w) =>
                        match(w.title, (w.suburbs ?? []).join(" "), names.get(w.seeker_id ?? "")),
                      )
                      .map((w) => (
                        <tr key={w.id}>
                          <td className="px-4 py-3">
                            <Link
                              to="/wanted/$id"
                              params={{ id: w.id }}
                              className="font-medium hover:underline"
                            >
                              {w.title}
                            </Link>
                            <div className="text-xs text-ink/50">
                              {(w.suburbs ?? []).join(", ") || "No suburbs"} · {w.bedrooms_min}+ bed
                              · {priceShort(w.deal, w.budget_cents)}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-xs text-ink/55">
                            {names.get(w.seeker_id ?? "") ?? "—"}
                            <div>{new Date(w.created_at).toLocaleDateString("en-AU")}</div>
                          </td>
                          <td className="px-4 py-3 text-xs">
                            <span
                              className={`rounded-full px-2 py-0.5 ${w.open ? "bg-brand/10 text-brand" : "bg-ink/10 text-ink/60"}`}
                            >
                              {w.open ? "Open" : "Closed"}
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-right">
                            <button
                              className={btn}
                              onClick={() =>
                                act.mutate({ kind: "wanted.open", id: w.id, value: !w.open })
                              }
                            >
                              {w.open ? "Close" : "Reopen"}
                            </button>{" "}
                            <button
                              className={danger}
                              onClick={() => {
                                if (confirm(`Delete “${w.title}”?`))
                                  act.mutate({ kind: "wanted.delete", id: w.id });
                              }}
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))}

                  {tab === "users" &&
                    d!.profiles
                      .filter((p) => match(p.display_name, p.suburb))
                      .map((p) => {
                        const isRowAdmin = adminIds.has(p.id);
                        return (
                          <tr key={p.id}>
                            <td className="px-4 py-3">
                              <span className="font-medium">{p.display_name || "Member"}</span>
                              <div className="text-xs text-ink/50">
                                {p.suburb || "No suburb"} · joined{" "}
                                {new Date(p.created_at).toLocaleDateString("en-AU")}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-xs text-ink/55">
                              {d!.listings.filter((l) => l.owner_id === p.id).length} listings ·{" "}
                              {d!.wanted.filter((w) => w.seeker_id === p.id).length} wanted
                            </td>
                            <td className="px-4 py-3 text-xs">
                              {isRowAdmin ? (
                                <span className="rounded-full bg-accent/20 px-2 py-0.5 text-ink">
                                  Admin
                                </span>
                              ) : null}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-right">
                              <button
                                className={btn}
                                disabled={p.id === user?.id}
                                onClick={() =>
                                  act.mutate({ kind: "role.set", id: p.id, value: !isRowAdmin })
                                }
                              >
                                {isRowAdmin ? "Revoke admin" : "Make admin"}
                              </button>
                            </td>
                          </tr>
                        );
                      })}

                  {tab === "applications" &&
                    d!.applications
                      .filter((a) => match(a.message, names.get(a.applicant_id)))
                      .map((a) => (
                        <tr key={a.id}>
                          <td className="px-4 py-3">
                            <span className="font-medium">
                              {names.get(a.applicant_id) ?? "Member"}
                            </span>
                            <div className="text-xs text-ink/50">{a.message || "No message"}</div>
                          </td>
                          <td className="px-4 py-3 text-xs text-ink/55">
                            <Link
                              to="/wanted/$id"
                              params={{ id: a.wanted_ad_id }}
                              className="hover:underline"
                            >
                              View wanted ad
                            </Link>
                            <div>{new Date(a.created_at).toLocaleDateString("en-AU")}</div>
                          </td>
                          <td className="px-4 py-3 text-xs capitalize">{a.status}</td>
                          <td />
                        </tr>
                      ))}

                  {tab === "comments" &&
                    d!.comments
                      .filter((c) => match(c.body, names.get(c.author_id ?? "")))
                      .map((c) => (
                        <tr key={c.id}>
                          <td className="px-4 py-3">
                            <div className="line-clamp-2">{c.body}</div>
                            <div className="text-xs text-ink/50">
                              {names.get(c.author_id ?? "") ?? "Member"} ·{" "}
                              {new Date(c.created_at).toLocaleDateString("en-AU")}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-xs text-ink/55">
                            {c.listing_id ? (
                              <Link
                                to="/listings/$id"
                                params={{ id: c.listing_id }}
                                className="hover:underline"
                              >
                                On a listing
                              </Link>
                            ) : c.wanted_ad_id ? (
                              <Link
                                to="/wanted/$id"
                                params={{ id: c.wanted_ad_id }}
                                className="hover:underline"
                              >
                                On a wanted ad
                              </Link>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td />
                          <td className="whitespace-nowrap px-4 py-3 text-right">
                            <button
                              className={danger}
                              onClick={() => {
                                if (confirm("Delete this comment?"))
                                  act.mutate({ kind: "comment.delete", id: c.id });
                              }}
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
