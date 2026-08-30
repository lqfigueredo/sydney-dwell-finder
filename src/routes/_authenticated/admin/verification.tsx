import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  AdminDenied,
  AdminShell,
  adminBtn,
  adminCard,
  adminDanger,
  adminPrimary,
} from "@/components/admin/AdminShell";
import { VerifiedSeal } from "@/components/VerifiedSeal";
import { useIsAdmin } from "@/hooks/use-is-admin";
import {
  decideVerification,
  getVerificationQueue,
  type VerificationStatus,
} from "@/lib/verification.functions";

export const Route = createFileRoute("/_authenticated/admin/verification")({
  head: () => ({
    meta: [
      { title: "Verification requests — SydHub Sydney" },
      {
        name: "description",
        content:
          "Review member identity documents, grant or revoke the SydHub verified seal and record the reason for every decision.",
      },
      { property: "og:title", content: "Verification requests — SydHub Sydney" },
      {
        property: "og:description",
        content: "Approve, decline or revoke the verified seal for SydHub Sydney members.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: VerificationPage,
});

const STATUS_TONE: Record<string, string> = {
  pending: "bg-accent/25 text-ink",
  needs_info: "bg-accent/25 text-ink",
  approved: "bg-brand/10 text-brand",
  rejected: "bg-red-700/10 text-red-700",
  revoked: "bg-red-700/10 text-red-700",
  none: "bg-ink/10 text-ink/60",
};

function Pill({ status }: { status: string }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ${STATUS_TONE[status] ?? STATUS_TONE["none"]}`}
    >
      {status.replace("_", " ")}
    </span>
  );
}

function VerificationPage() {
  const { isAdmin, loading } = useIsAdmin();
  const qc = useQueryClient();
  const queueFn = useServerFn(getVerificationQueue);
  const decideFn = useServerFn(decideVerification);
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [tab, setTab] = useState<"open" | "all">("open");

  const queue = useQuery({
    queryKey: ["verification-queue"],
    enabled: isAdmin,
    queryFn: () => queueFn({}),
  });

  const decide = useMutation({
    mutationFn: (input: Parameters<typeof decideFn>[0]["data"]) => decideFn({ data: input }),
    onSuccess: () => {
      toast.success("Decision recorded");
      void qc.invalidateQueries({ queryKey: ["verification-queue"] });
      void qc.invalidateQueries({ queryKey: ["admin-snapshot"] });
      void qc.invalidateQueries({ queryKey: ["my-verification"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const profileById = useMemo(
    () => new Map((queue.data?.profiles ?? []).map((p) => [p.id, p])),
    [queue.data],
  );

  if (loading) {
    return (
      <AdminShell title="Verification" subtitle="Checking access…">
        <p className="text-sm text-ink/50">One moment…</p>
      </AdminShell>
    );
  }
  if (!isAdmin) return <AdminDenied />;

  const all = queue.data?.requests ?? [];
  const rows = tab === "open" ? all.filter((r) => r.status === "pending" || r.status === "needs_info") : all;

  return (
    <AdminShell
      title="Verification"
      subtitle="Review identity documents and decide who gets the verified seal. Verified members' posts skip photo review."
    >
      <div className="flex gap-2">
        {(["open", "all"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-[10px] px-3 py-1.5 text-sm font-medium ring-1 ${
              tab === t
                ? "bg-brand text-brand-foreground ring-brand/25"
                : "text-ink/60 ring-ink/15 hover:bg-ink/5"
            }`}
          >
            {t === "open" ? `Awaiting review (${all.filter((r) => r.status === "pending" || r.status === "needs_info").length})` : `All requests (${all.length})`}
          </button>
        ))}
      </div>

      {queue.isLoading ? (
        <p className="mt-6 text-sm text-ink/50">Loading requests…</p>
      ) : queue.error ? (
        <p className="mt-6 text-sm text-red-700">{(queue.error as Error).message}</p>
      ) : rows.length === 0 ? (
        <p className="mt-6 text-sm text-ink/50">Nothing here right now.</p>
      ) : (
        <div className="mt-5 space-y-4">
          {rows.map((r) => {
            const p = profileById.get(r.user_id);
            const docs = queue.data?.docsByRequest[r.id] ?? [];
            const reason = reasons[r.id] ?? "";
            const busy = decide.isPending;
            const memberStatus = (p?.verification_status ?? "none") as VerificationStatus;
            return (
              <div key={r.id} className={adminCard}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="font-display text-lg font-semibold">
                        {p?.display_name || r.full_name}
                      </h2>
                      <Pill status={r.status} />
                      {memberStatus === "approved" ? <VerifiedSeal label="Verified" /> : null}
                    </div>
                    <p className="mt-1 text-xs text-ink/55">
                      {r.member_kind} · legal name {r.full_name} · {r.phone || "no phone"} ·
                      submitted {new Date(r.created_at).toLocaleString("en-AU")}
                    </p>
                    {r.note ? (
                      <p className="mt-2 max-w-[70ch] rounded-[10px] bg-ink/[0.03] p-3 text-xs text-ink/70">
                        {r.note}
                      </p>
                    ) : null}
                    {r.decision_reason ? (
                      <p className="mt-2 text-xs text-ink/55">
                        Last decision note: {r.decision_reason}
                      </p>
                    ) : null}
                  </div>
                  <div className="text-right text-xs text-ink/45">
                    Member since{" "}
                    {p ? new Date(p.created_at).toLocaleDateString("en-AU") : "—"}
                    <div>{p?.suburb || "No suburb"}</div>
                  </div>
                </div>

                <div className="mt-3">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-ink/45">
                    Documents ({docs.length})
                  </div>
                  {docs.length === 0 ? (
                    <p className="mt-1 text-xs text-ink/45">No documents attached.</p>
                  ) : (
                    <div className="mt-2 flex flex-wrap gap-3">
                      {docs.map((d) =>
                        d.mime_type?.startsWith("image/") ? (
                          <a key={d.id} href={d.url} target="_blank" rel="noreferrer" title={d.label}>
                            <img
                              src={d.url}
                              alt={`Verification document: ${d.label}`}
                              className="size-24 rounded-[10px] object-cover ring-1 ring-ink/10"
                            />
                          </a>
                        ) : (
                          <a
                            key={d.id}
                            href={d.url}
                            target="_blank"
                            rel="noreferrer"
                            className="flex size-24 items-center justify-center rounded-[10px] p-2 text-center text-[10px] ring-1 ring-ink/15 hover:bg-ink/5"
                          >
                            {d.label}
                          </a>
                        ),
                      )}
                    </div>
                  )}
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <input
                    value={reason}
                    onChange={(e) => setReasons((s) => ({ ...s, [r.id]: e.target.value }))}
                    placeholder="Reason (required to decline, ask for more info or revoke)"
                    className="min-w-[280px] flex-1 rounded-[10px] border border-ink/15 bg-surface px-3 py-1.5 text-sm outline-none focus:border-brand"
                  />
                  <button
                    className={adminPrimary}
                    disabled={busy}
                    onClick={() =>
                      decide.mutate({
                        userId: r.user_id,
                        requestId: r.id,
                        decision: "approved",
                        reason,
                      })
                    }
                  >
                    Grant seal
                  </button>
                  <button
                    className={adminBtn}
                    disabled={busy}
                    onClick={() =>
                      decide.mutate({
                        userId: r.user_id,
                        requestId: r.id,
                        decision: "needs_info",
                        reason,
                      })
                    }
                  >
                    Needs more info
                  </button>
                  <button
                    className={adminDanger}
                    disabled={busy}
                    onClick={() =>
                      decide.mutate({
                        userId: r.user_id,
                        requestId: r.id,
                        decision: "rejected",
                        reason,
                      })
                    }
                  >
                    Decline
                  </button>
                  {memberStatus === "approved" ? (
                    <button
                      className={adminDanger}
                      disabled={busy}
                      onClick={() =>
                        decide.mutate({
                          userId: r.user_id,
                          requestId: r.id,
                          decision: "revoked",
                          reason,
                        })
                      }
                    >
                      Revoke seal
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </AdminShell>
  );
}
