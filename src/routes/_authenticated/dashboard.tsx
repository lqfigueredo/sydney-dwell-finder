import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { AppHeader } from "@/components/AppHeader";
import { formatPrice, priceShort, type Listing, type WantedAd } from "@/lib/marketplace";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "My activity — Tidewater Sydney" },
      {
        name: "description",
        content:
          "Manage your Sydney listings, wanted ads and the applications flowing between them.",
      },
      { property: "og:title", content: "My activity — Tidewater Sydney" },
      {
        property: "og:description",
        content: "Manage your listings, wanted ads and applications.",
      },
    ],
  }),
  component: Dashboard,
});

type AppRow = {
  id: string;
  status: string;
  message: string;
  created_at: string;
  wanted_ad_id: string;
  applicant_id: string;
  listing_id: string | null;
  wanted_ads: { title: string; seeker_id: string | null } | null;
  listings: { title: string; suburb: string } | null;
};

function Dashboard() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const listings = useQuery({
    queryKey: ["dash-listings", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("listings")
        .select("*")
        .eq("owner_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Listing[];
    },
  });

  const ads = useQuery({
    queryKey: ["dash-wanted", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wanted_ads")
        .select("*")
        .eq("seeker_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as WantedAd[];
    },
  });

  const applications = useQuery({
    queryKey: ["dash-applications", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("applications")
        .select(
          "id, status, message, created_at, wanted_ad_id, applicant_id, listing_id, wanted_ads(title, seeker_id), listings(title, suburb)",
        )
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as AppRow[];
    },
  });

  const decide = async (id: string, status: "accepted" | "declined") => {
    const { error } = await supabase.from("applications").update({ status }).eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`Application ${status}.`);
    void qc.invalidateQueries({ queryKey: ["dash-applications", user?.id] });
  };

  const received = (applications.data ?? []).filter((a) => a.applicant_id !== user?.id);
  const sent = (applications.data ?? []).filter((a) => a.applicant_id === user?.id);

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <AppHeader />
      <main className="mx-auto max-w-[1100px] px-6 py-8">
        <h1 className="font-display text-3xl font-semibold">My activity</h1>

        <div className="mt-6 grid grid-cols-12 gap-5">
          <section className="col-span-12 lg:col-span-6">
            <Panel
              title="My properties"
              action={
                <Link to="/post-listing" className="text-[12px] font-medium text-brand">
                  + New
                </Link>
              }
            >
              {listings.data?.length === 0 && <Empty>You haven't listed a property yet.</Empty>}
              {listings.data?.map((l) => (
                <Link
                  key={l.id}
                  to="/listings/$id"
                  params={{ id: l.id }}
                  className="flex items-center justify-between rounded-[10px] bg-ink/[0.03] px-3.5 py-2.5 text-sm hover:bg-ink/[0.06]"
                >
                  <span className="truncate font-medium">{l.title}</span>
                  <span className="ml-3 shrink-0 text-ink/50">
                    {priceShort(l.deal, l.price_cents)}
                  </span>
                </Link>
              ))}
            </Panel>
          </section>

          <section className="col-span-12 lg:col-span-6">
            <Panel
              title="My wanted ads"
              action={
                <Link to="/post-wanted" className="text-[12px] font-medium text-brand">
                  + New
                </Link>
              }
            >
              {ads.data?.length === 0 && <Empty>No wanted ads yet.</Empty>}
              {ads.data?.map((w) => (
                <Link
                  key={w.id}
                  to="/wanted/$id"
                  params={{ id: w.id }}
                  className="flex items-center justify-between rounded-[10px] bg-brand/[0.05] px-3.5 py-2.5 text-sm hover:bg-brand/10"
                >
                  <span className="truncate font-medium">{w.title}</span>
                  <span className="ml-3 shrink-0 text-brand">
                    {formatPrice(w.deal, w.budget_cents)}
                  </span>
                </Link>
              ))}
            </Panel>
          </section>

          <section className="col-span-12 lg:col-span-6">
            <Panel title="Applications to my ads">
              {received.length === 0 && <Empty>No one has applied to your wanted ads yet.</Empty>}
              {received.map((a) => (
                <div key={a.id} className="rounded-[10px] bg-ink/[0.03] p-3.5">
                  <p className="text-[12px] text-ink/45">
                    for <strong className="text-ink/70">{a.wanted_ads?.title}</strong>
                  </p>
                  {a.listings && (
                    <p className="mt-1 text-[13px] font-medium">
                      {a.listings.title} · {a.listings.suburb}
                    </p>
                  )}
                  <p className="mt-1 text-sm text-ink/70">{a.message}</p>
                  {a.status === "pending" ? (
                    <div className="mt-2.5 flex gap-2">
                      <button
                        onClick={() => decide(a.id, "accepted")}
                        className="rounded-[8px] bg-brand px-3 py-1.5 text-[12px] font-semibold text-brand-foreground"
                      >
                        Accept
                      </button>
                      <button
                        onClick={() => decide(a.id, "declined")}
                        className="rounded-[8px] px-3 py-1.5 text-[12px] font-medium text-ink/60 ring-1 ring-ink/15"
                      >
                        Decline
                      </button>
                    </div>
                  ) : (
                    <p className="mt-2 text-[12px] font-medium uppercase tracking-[0.14em] text-ink/45">
                      {a.status}
                    </p>
                  )}
                </div>
              ))}
            </Panel>
          </section>

          <section className="col-span-12 lg:col-span-6">
            <Panel title="Applications I've sent">
              {sent.length === 0 && <Empty>You haven't applied to a wanted ad yet.</Empty>}
              {sent.map((a) => (
                <Link
                  key={a.id}
                  to="/wanted/$id"
                  params={{ id: a.wanted_ad_id }}
                  className="block rounded-[10px] bg-ink/[0.03] p-3.5 hover:bg-ink/[0.06]"
                >
                  <p className="text-[13px] font-medium">{a.wanted_ads?.title}</p>
                  <p className="mt-1 line-clamp-2 text-[13px] text-ink/60">{a.message}</p>
                  <p className="mt-1.5 text-[11px] font-medium uppercase tracking-[0.14em] text-ink/45">
                    {a.status}
                  </p>
                </Link>
              ))}
            </Panel>
          </section>
        </div>
      </main>
    </div>
  );
}

function Panel({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl bg-canvas p-5 ring-1 ring-ink/10">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-[15px] font-semibold">{title}</h2>
        {action}
      </div>
      <div className="mt-3 space-y-2">{children}</div>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-[13px] text-ink/45">{children}</p>;
}
