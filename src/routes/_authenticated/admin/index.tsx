import { useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AdminDenied, AdminShell, AdminStat, adminCard } from "@/components/admin/AdminShell";
import { useAdminData } from "@/hooks/use-admin-data";

export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => ({
    meta: [
      { title: "Admin dashboard — SydHub Sydney" },
      {
        name: "description",
        content:
          "Live SydHub marketplace metrics: listings, wanted ads, active and inactive counts and new submissions over time.",
      },
      { property: "og:title", content: "Admin dashboard — SydHub Sydney" },
      {
        property: "og:description",
        content: "Marketplace totals, moderation backlog and submission trends for SydHub Sydney.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminDashboard,
});

const DAYS = 30;

function AdminDashboard() {
  const { isAdmin, loading, snapshot, data } = useAdminData();

  const stats = useMemo(() => {
    if (!data) return null;
    const now = Date.now();
    const since = (days: number) => now - days * 864e5;
    const countSince = (rows: { created_at: string }[], days: number) =>
      rows.filter((r) => new Date(r.created_at).getTime() > since(days)).length;
    const photoListingIds = new Set(data.photos.map((p) => p.listing_id));
    const byStatus = (rows: { moderation_status: string }[], s: string) =>
      rows.filter((r) => r.moderation_status === s).length;

    const buckets = Array.from({ length: DAYS }, (_, i) => {
      const day = new Date(now - (DAYS - 1 - i) * 864e5);
      day.setHours(0, 0, 0, 0);
      const next = day.getTime() + 864e5;
      const inDay = (rows: { created_at: string }[]) =>
        rows.filter((r) => {
          const t = new Date(r.created_at).getTime();
          return t >= day.getTime() && t < next;
        }).length;
      return { date: day, listings: inDay(data.listings), wanted: inDay(data.wanted) };
    });

    return {
      listings: data.listings.length,
      published: data.listings.filter((l) => l.published).length,
      wanted: data.wanted.length,
      openWanted: data.wanted.filter((w) => w.open).length,
      users: data.profiles.length,
      deactivated: data.profiles.filter((p) => p.deactivated_at).length,
      admins: new Set(data.roles.filter((r) => r.role === "admin").map((r) => r.user_id)).size,
      applications: data.applications.length,
      pending: data.applications.filter((a) => a.status === "pending").length,
      comments: data.comments.length,
      photos: data.photos.length,
      listingPending: byStatus(data.listings, "pending"),
      listingApproved: byStatus(data.listings, "approved"),
      listingRejected: byStatus(data.listings, "rejected"),
      listingPaused: byStatus(data.listings, "paused"),
      wantedPending: byStatus(data.wanted, "pending"),
      wantedApproved: byStatus(data.wanted, "approved"),
      wantedRejected: byStatus(data.wanted, "rejected"),
      wantedPaused: byStatus(data.wanted, "paused"),
      new7: countSince(data.listings, 7) + countSince(data.wanted, 7),
      new30: countSince(data.listings, 30) + countSince(data.wanted, 30),
      noLocation: data.listings.filter((l) => l.lat == null || l.lng == null).length,
      noPhotos: data.listings.filter((l) => !l.cover_url && !photoListingIds.has(l.id)).length,
      noSuburbs: data.wanted.filter((w) => (w.suburbs ?? []).length === 0).length,
      buckets,
    };
  }, [data]);

  if (loading) {
    return (
      <AdminShell title="Admin console" subtitle="Checking access…">
        <p className="text-sm text-ink/50">One moment…</p>
      </AdminShell>
    );
  }
  if (!isAdmin) return <AdminDenied />;

  const max = Math.max(1, ...(stats?.buckets ?? []).map((b) => b.listings + b.wanted));

  return (
    <AdminShell
      title="Admin dashboard"
      subtitle="Marketplace totals, moderation backlog and submission trends."
    >
      {snapshot.isLoading ? (
        <p className="text-sm text-ink/50">Loading marketplace data…</p>
      ) : snapshot.error ? (
        <p className="text-sm text-red-700">{(snapshot.error as Error).message}</p>
      ) : stats ? (
        <>
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <AdminStat
              label="Properties"
              value={stats.listings}
              hint={`${stats.published} published · ${stats.listings - stats.published} hidden`}
            />
            <AdminStat
              label="Wanted ads"
              value={stats.wanted}
              hint={`${stats.openWanted} open · ${stats.wanted - stats.openWanted} closed`}
            />
            <AdminStat
              label="Members"
              value={stats.users}
              hint={`${stats.admins} admin(s) · ${stats.deactivated} deactivated`}
            />
            <AdminStat
              label="Applications"
              value={stats.applications}
              hint={`${stats.pending} pending`}
            />
          </section>

          <section className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <AdminStat
              label="Listings by state"
              value={`${stats.listingApproved} active`}
              hint={`${stats.listingPending} pending · ${stats.listingPaused} paused · ${stats.listingRejected} rejected`}
            />
            <AdminStat
              label="Wanted ads by state"
              value={`${stats.wantedApproved} active`}
              hint={`${stats.wantedPending} pending · ${stats.wantedPaused} paused · ${stats.wantedRejected} rejected`}
            />
            <AdminStat
              label="New submissions"
              value={stats.new7}
              hint={`last 7 days · ${stats.new30} in last 30 days`}
            />
            <AdminStat
              label="Needs attention"
              value={
                stats.listingPending +
                stats.wantedPending +
                stats.noLocation +
                stats.noPhotos +
                stats.noSuburbs
              }
              hint={`${stats.listingPending + stats.wantedPending} awaiting review · ${stats.noPhotos} without photos · ${stats.noLocation} without a map pin · ${stats.noSuburbs} ads without suburbs`}
            />
          </section>

          <section className={`mt-6 ${adminCard}`}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-display text-sm font-semibold">New submissions — last 30 days</h2>
              <div className="flex items-center gap-3 text-[11px] text-ink/55">
                <span className="flex items-center gap-1">
                  <i className="inline-block h-2 w-2 rounded-full bg-brand" /> Listings
                </span>
                <span className="flex items-center gap-1">
                  <i className="inline-block h-2 w-2 rounded-full bg-accent" /> Wanted ads
                </span>
              </div>
            </div>
            <div className="mt-4 flex h-40 items-end gap-[3px]">
              {stats.buckets.map((b) => {
                const total = b.listings + b.wanted;
                return (
                  <div
                    key={b.date.toISOString()}
                    className="group relative flex flex-1 flex-col justify-end"
                    title={`${b.date.toLocaleDateString("en-AU", { day: "numeric", month: "short" })}: ${b.listings} listings, ${b.wanted} wanted`}
                  >
                    <div
                      className="w-full rounded-t-[3px] bg-accent"
                      style={{ height: `${(b.wanted / max) * 100}%` }}
                    />
                    <div
                      className="w-full bg-brand"
                      style={{ height: `${(b.listings / max) * 100}%` }}
                    />
                    <div
                      className={`h-[2px] w-full ${total ? "bg-transparent" : "bg-ink/10"}`}
                      aria-hidden
                    />
                  </div>
                );
              })}
            </div>
            <div className="mt-2 flex justify-between text-[11px] text-ink/45">
              <span>
                {stats.buckets[0]?.date.toLocaleDateString("en-AU", {
                  day: "numeric",
                  month: "short",
                })}
              </span>
              <span>Today</span>
            </div>
          </section>

          <section className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <AdminStat label="Comments" value={stats.comments} />
            <AdminStat label="Photos uploaded" value={stats.photos} />
          </section>
        </>
      ) : null}
    </AdminShell>
  );
}
