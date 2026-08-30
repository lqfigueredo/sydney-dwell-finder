import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AdminDenied, AdminShell, adminBtn, adminCard } from "@/components/admin/AdminShell";
import { useAdminData } from "@/hooks/use-admin-data";
import { getSystemHealth } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin/health")({
  head: () => ({
    meta: [
      { title: "System health — SydHub Sydney" },
      {
        name: "description",
        content:
          "Live status for the SydHub database, accounts, photo storage and Google Maps, plus recently recorded errors.",
      },
      { property: "og:title", content: "System health — SydHub Sydney" },
      {
        property: "og:description",
        content: "Integration status and recent error log for the SydHub Sydney marketplace.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: HealthPage,
});

const TONE: Record<string, string> = {
  ok: "bg-brand/10 text-brand",
  degraded: "bg-accent/30 text-ink",
  failed: "bg-red-700/10 text-red-700",
};

function HealthPage() {
  const { isAdmin, loading, act } = useAdminData();
  const healthFn = useServerFn(getSystemHealth);

  const health = useQuery({
    queryKey: ["admin-health"],
    enabled: isAdmin,
    queryFn: () => healthFn({}),
    refetchInterval: 60_000,
  });

  if (loading) {
    return (
      <AdminShell title="System health" subtitle="Checking access…">
        <p className="text-sm text-ink/50">One moment…</p>
      </AdminShell>
    );
  }
  if (!isAdmin) return <AdminDenied />;

  const d = health.data;

  return (
    <AdminShell
      title="System health"
      subtitle="Integration status and recently recorded errors across SydHub."
    >
      <div className="flex flex-wrap items-center gap-3">
        <button className={adminBtn} onClick={() => void health.refetch()}>
          {health.isFetching ? "Checking…" : "Run checks again"}
        </button>
        {d ? (
          <span className="text-xs text-ink/50">
            Last checked {new Date(d.checkedAt).toLocaleTimeString("en-AU")}
          </span>
        ) : null}
      </div>

      {health.isLoading ? (
        <p className="mt-6 text-sm text-ink/50">Running integration checks…</p>
      ) : health.error ? (
        <p className="mt-6 text-sm text-red-700">{(health.error as Error).message}</p>
      ) : d ? (
        <>
          <section className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {d.checks.map((c) => (
              <div key={c.key} className={adminCard}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-medium uppercase tracking-wide text-ink/45">
                    {c.label}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ${TONE[c.status]}`}
                  >
                    {c.status}
                  </span>
                </div>
                <div className="mt-2 text-sm text-ink/75">{c.detail}</div>
                <div className="mt-1 text-xs text-ink/45">{c.ms} ms</div>
              </div>
            ))}
          </section>

          <section className={`mt-6 ${adminCard}`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-display text-sm font-semibold">
                Recent errors{" "}
                <span className="font-normal text-ink/45">({d.errors.length})</span>
              </h2>
              {d.errors.length ? (
                <button
                  className={adminBtn}
                  onClick={() => {
                    if (confirm("Clear the error log?")) {
                      act.mutate(
                        { kind: "errors.clear" },
                        { onSuccess: () => void health.refetch() },
                      );
                    }
                  }}
                >
                  Clear log
                </button>
              ) : null}
            </div>

            {d.errors.length === 0 ? (
              <p className="mt-3 text-sm text-ink/50">
                No errors recorded. Runtime failures will appear here as they happen.
              </p>
            ) : (
              <ul className="mt-3 divide-y divide-ink/10">
                {d.errors.map((e) => (
                  <li key={e.id} className="py-2.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-red-700/10 px-2 py-0.5 text-[11px] text-red-700">
                        {e.source}
                      </span>
                      <span className="text-sm font-medium">{e.message}</span>
                      <span className="ml-auto text-xs text-ink/45">
                        {new Date(e.created_at).toLocaleString("en-AU")}
                      </span>
                    </div>
                    {e.route ? <div className="mt-0.5 text-xs text-ink/50">{e.route}</div> : null}
                    {e.detail ? (
                      <pre className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap rounded-[8px] bg-ink/[0.03] p-2 text-[11px] text-ink/60">
                        {e.detail}
                      </pre>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      ) : null}
    </AdminShell>
  );
}
