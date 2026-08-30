import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { decideVerification } from "@/lib/verification.functions";
import { useServerFn } from "@tanstack/react-start";
import {
  AdminDenied,
  AdminShell,
  StatusPill,
  adminBtn,
  adminCard,
  adminDanger,
} from "@/components/admin/AdminShell";
import { useAdminData } from "@/hooks/use-admin-data";
import { VerifiedSeal } from "@/components/VerifiedSeal";
import { useAuth } from "@/hooks/use-auth";
import { getAdminUserDetail } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin/users")({
  head: () => ({
    meta: [
      { title: "Member management — SydHub Sydney" },
      {
        name: "description",
        content:
          "Search SydHub members, review their profile and activity, grant admin access or deactivate an account.",
      },
      { property: "og:title", content: "Member management — SydHub Sydney" },
      {
        property: "og:description",
        content: "Search members, inspect profiles and manage account status on SydHub Sydney.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: UsersPage,
});

function UsersPage() {
  const { user } = useAuth();
  const { isAdmin, loading, snapshot, data, act } = useAdminData();
  const detailFn = useServerFn(getAdminUserDetail);
  const decideFn = useServerFn(decideVerification);
  const qc = useQueryClient();
  const decide = useMutation({
    mutationFn: (input: Parameters<typeof decideFn>[0]["data"]) => decideFn({ data: input }),
    onSuccess: () => {
      toast.success("Verification updated");
      void qc.invalidateQueries({ queryKey: ["admin-snapshot"] });
      void qc.invalidateQueries({ queryKey: ["verification-queue"] });
      void qc.invalidateQueries({ queryKey: ["admin-user-detail"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<string | null>(null);

  const adminIds = useMemo(
    () => new Set((data?.roles ?? []).filter((r) => r.role === "admin").map((r) => r.user_id)),
    [data],
  );

  const detail = useQuery({
    queryKey: ["admin-user-detail", selected],
    enabled: !!selected,
    queryFn: () => detailFn({ data: { id: selected! } }),
  });

  if (loading) {
    return (
      <AdminShell title="Members" subtitle="Checking access…">
        <p className="text-sm text-ink/50">One moment…</p>
      </AdminShell>
    );
  }
  if (!isAdmin) return <AdminDenied />;

  const term = q.trim().toLowerCase();
  const members = (data?.profiles ?? []).filter(
    (p) =>
      !term ||
      [p.display_name, p.suburb, p.id].join(" ").toLowerCase().includes(term),
  );

  const d = detail.data;

  return (
    <AdminShell
      title="Members"
      subtitle="Search accounts, review activity, manage admin access and account status."
    >
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search by name, suburb or account id…"
        className="w-full max-w-md rounded-[10px] border border-ink/15 bg-surface px-3 py-2 text-sm outline-none focus:border-brand"
      />

      {snapshot.isLoading ? (
        <p className="mt-6 text-sm text-ink/50">Loading members…</p>
      ) : snapshot.error ? (
        <p className="mt-6 text-sm text-red-700">{(snapshot.error as Error).message}</p>
      ) : (
        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
          <div className="overflow-x-auto rounded-[14px] border border-ink/10 bg-surface">
            <table className="w-full min-w-[620px] text-left text-sm">
              <tbody className="divide-y divide-ink/10">
                {members.map((p) => {
                  const isRowAdmin = adminIds.has(p.id);
                  const off = !!p.deactivated_at;
                  const sealExpired =
                    !!p.verified_until && new Date(p.verified_until).getTime() <= Date.now();
                  const verified = !!p.verified_at && !sealExpired;
                  return (
                    <tr key={p.id} className={selected === p.id ? "bg-brand/5" : undefined}>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => setSelected(p.id)}
                          className="text-left font-medium hover:underline"
                        >
                          {p.display_name || "Member"}
                        </button>
                        <div className="text-xs text-ink/50">
                          {p.suburb || "No suburb"} · joined{" "}
                          {new Date(p.created_at).toLocaleDateString("en-AU")}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-ink/55">
                        {(data?.listings ?? []).filter((l) => l.owner_id === p.id).length} listings ·{" "}
                        {(data?.wanted ?? []).filter((w) => w.seeker_id === p.id).length} wanted
                      </td>
                      <td className="space-x-1 px-4 py-3 text-xs">
                        {isRowAdmin ? (
                          <span className="rounded-full bg-accent/25 px-2 py-0.5">Admin</span>
                        ) : null}
                        {verified ? <VerifiedSeal label="Verified" /> : null}
                        {off ? (
                          <span className="rounded-full bg-red-700/10 px-2 py-0.5 text-red-700">
                            Deactivated
                          </span>
                        ) : null}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right">
                        <button
                          className={adminBtn}
                          disabled={p.id === user?.id}
                          onClick={() =>
                            act.mutate({ kind: "role.set", id: p.id, value: !isRowAdmin })
                          }
                        >
                          {isRowAdmin ? "Revoke admin" : "Make admin"}
                        </button>{" "}
                        <button
                          className={adminBtn}
                          disabled={decide.isPending}
                          onClick={() => {
                            const reason = prompt(
                              verified
                                ? `Why are you removing ${p.display_name || "this member"}'s verified seal? The member sees this note.`
                                : `Optional note for ${p.display_name || "this member"} — granting the seal makes their future listings and wanted ads go live without review.`,
                              "",
                            );
                            if (reason === null) return;
                            if (verified && reason.trim().length < 3) {
                              alert("Please give a reason before revoking the seal.");
                              return;
                            }
                            decide.mutate({
                              userId: p.id,
                              decision: verified ? "revoked" : "approved",
                              reason,
                            });
                          }}
                        >
                          {verified ? "Revoke seal" : "Verify member"}
                        </button>{" "}
                        <button
                          className={off ? adminBtn : adminDanger}
                          disabled={p.id === user?.id}
                          onClick={() => {
                            if (
                              off ||
                              confirm(
                                `Deactivate ${p.display_name || "this member"}? Their listings and wanted ads will be hidden from the public site.`,
                              )
                            )
                              act.mutate({ kind: "user.deactivate", id: p.id, value: !off });
                          }}
                        >
                          {off ? "Reactivate" : "Deactivate"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {members.length === 0 ? (
                  <tr>
                    <td className="px-4 py-6 text-sm text-ink/50">No members match that search.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          <aside className={adminCard}>
            {!selected ? (
              <p className="text-sm text-ink/50">Select a member to see their full profile.</p>
            ) : detail.isLoading ? (
              <p className="text-sm text-ink/50">Loading profile…</p>
            ) : detail.error ? (
              <p className="text-sm text-red-700">{(detail.error as Error).message}</p>
            ) : d?.profile ? (
              <>
                <h2 className="font-display text-lg font-semibold">
                  {d.profile.display_name || "Member"}
                </h2>
                <dl className="mt-3 space-y-1.5 text-xs text-ink/60">
                  <div>Account id: {d.profile.id}</div>
                  <div>Suburb: {d.profile.suburb || "—"}</div>
                  <div>Phone: {d.profile.phone || "—"}</div>
                  <div>Joined: {new Date(d.profile.created_at).toLocaleString("en-AU")}</div>
                  <div>Roles: {d.roles.length ? d.roles.join(", ") : "member"}</div>
                  <div>
                    Status:{" "}
                    {d.profile.deactivated_at
                      ? `Deactivated ${new Date(d.profile.deactivated_at).toLocaleDateString("en-AU")}`
                      : "Active"}
                  </div>
                </dl>
                {d.profile.bio ? (
                  <p className="mt-3 rounded-[10px] bg-ink/[0.03] p-3 text-xs text-ink/70">
                    {d.profile.bio}
                  </p>
                ) : null}

                <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                  {[
                    ["Listings", d.listings.length],
                    ["Wanted", d.wanted.length],
                    ["Applications", d.applications.length],
                  ].map(([label, value]) => (
                    <div key={label as string} className="rounded-[10px] bg-ink/[0.03] p-2">
                      <div className="font-display text-lg font-semibold">{value}</div>
                      <div className="text-[10px] uppercase tracking-wide text-ink/45">{label}</div>
                    </div>
                  ))}
                </div>
                <p className="mt-2 text-xs text-ink/50">{d.commentCount} comment(s) posted</p>

                <h3 className="mt-4 text-[11px] font-semibold uppercase tracking-wide text-ink/45">
                  Their listings
                </h3>
                <ul className="mt-1.5 space-y-1.5">
                  {d.listings.length === 0 ? (
                    <li className="text-xs text-ink/45">None</li>
                  ) : (
                    d.listings.map((l) => (
                      <li key={l.id} className="flex items-center justify-between gap-2 text-xs">
                        <Link
                          to="/listings/$id"
                          params={{ id: l.id }}
                          className="truncate hover:underline"
                        >
                          {l.title}
                        </Link>
                        <StatusPill status={l.moderation_status} />
                      </li>
                    ))
                  )}
                </ul>

                <h3 className="mt-4 text-[11px] font-semibold uppercase tracking-wide text-ink/45">
                  Their wanted ads
                </h3>
                <ul className="mt-1.5 space-y-1.5">
                  {d.wanted.length === 0 ? (
                    <li className="text-xs text-ink/45">None</li>
                  ) : (
                    d.wanted.map((w) => (
                      <li key={w.id} className="flex items-center justify-between gap-2 text-xs">
                        <Link
                          to="/wanted/$id"
                          params={{ id: w.id }}
                          className="truncate hover:underline"
                        >
                          {w.title}
                        </Link>
                        <StatusPill status={w.moderation_status} />
                      </li>
                    ))
                  )}
                </ul>
              </>
            ) : (
              <p className="text-sm text-ink/50">Profile not found.</p>
            )}
          </aside>
        </div>
      )}
    </AdminShell>
  );
}
