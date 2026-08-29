import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { AppHeader } from "@/components/AppHeader";
import { CommentThread } from "@/components/CommentThread";
import { BlueprintMap } from "@/components/BlueprintMap";
import { coordsFor, formatPrice, type Listing, type WantedAd } from "@/lib/marketplace";

export const Route = createFileRoute("/wanted/$id")({
  head: () => ({
    meta: [
      { title: "Wanted ad — Tidewater Sydney" },
      {
        name: "description",
        content:
          "A Sydney seeker's brief: budget, suburbs and must-haves. Owners can apply with a matching property.",
      },
      { property: "og:title", content: "Wanted ad — Tidewater Sydney" },
      {
        property: "og:description",
        content: "See what this Sydney seeker wants and offer them a matching property.",
      },
    ],
  }),
  component: WantedDetail,
});

function WantedDetail() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [message, setMessage] = useState("");
  const [listingId, setListingId] = useState("");

  const ad = useQuery({
    queryKey: ["wanted", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wanted_ads")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data as WantedAd | null;
    },
  });

  const myListings = useQuery({
    queryKey: ["my-listings", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("listings")
        .select("*")
        .eq("owner_id", user!.id);
      if (error) throw error;
      return data as Listing[];
    },
  });

  const myApplication = useQuery({
    queryKey: ["my-application", id, user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("applications")
        .select("id, status")
        .eq("wanted_ad_id", id)
        .eq("applicant_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const apply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const { error } = await supabase.from("applications").insert({
      wanted_ad_id: id,
      applicant_id: user.id,
      listing_id: listingId || null,
      message: message.trim(),
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Application sent to the seeker.");
    setMessage("");
    void qc.invalidateQueries({ queryKey: ["my-application", id, user.id] });
  };

  const w = ad.data;
  const coords = w ? coordsFor(w) : null;
  const isOwner = !!user && w?.seeker_id === user.id;

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <AppHeader mode="wanted" />
      <main className="mx-auto max-w-[1100px] px-6 py-8">
        <Link to="/" className="text-[12px] font-medium text-ink/45 hover:text-ink">
          ← Back to the map
        </Link>

        {ad.isLoading && <div className="mt-6 h-56 animate-pulse rounded-xl bg-ink/5" />}
        {!ad.isLoading && !w && (
          <p className="mt-6 rounded-xl bg-ink/[0.03] p-8 text-sm text-ink/55 ring-1 ring-ink/10">
            This wanted ad is no longer open.
          </p>
        )}

        {w && (
          <div className="mt-4 grid grid-cols-12 gap-5">
            <div className="col-span-12 space-y-6 lg:col-span-7">
              <div className="rounded-xl bg-brand/[0.05] p-6 ring-1 ring-brand/15">
                <span className="rounded-full bg-brand/12 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-brand">
                  Wanted · {w.deal === "rent" ? "rental" : "purchase"}
                </span>
                <h1 className="mt-3 font-display text-3xl font-semibold">{w.title}</h1>
                <p className="mt-2 text-sm text-ink/60">
                  {w.suburbs.join(" · ") || "Anywhere in Sydney"}
                </p>
                <div className="mt-5 grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
                  <Stat
                    label="Budget"
                    value={`${formatPrice(w.deal, w.budget_cents)}${w.deal === "rent" ? "/wk" : ""}`}
                  />
                  <Stat label="Bedrooms" value={`${w.bedrooms_min}+`} />
                  <Stat label="Move in" value={w.move_in_date ?? "Flexible"} />
                  <Stat label="Status" value={w.open ? "Open" : "Closed"} />
                </div>
                {w.must_haves.length > 0 && (
                  <div className="mt-5 flex flex-wrap gap-2 text-[12px]">
                    {w.must_haves.map((m) => (
                      <span
                        key={m}
                        className="rounded-full bg-canvas px-3 py-1 font-medium text-ink/70 ring-1 ring-ink/10"
                      >
                        {m}
                      </span>
                    ))}
                  </div>
                )}
                {w.notes && (
                  <p className="mt-5 whitespace-pre-line text-sm leading-relaxed text-ink/75">
                    {w.notes}
                  </p>
                )}
              </div>

              <CommentThread target={{ wantedId: w.id }} />
            </div>

            <aside className="col-span-12 space-y-4 lg:col-span-5">
              <div className="rounded-xl bg-canvas p-5 ring-1 ring-ink/10">
                <h2 className="font-display text-[15px] font-semibold">
                  Have something that fits?
                </h2>
                {!user && (
                  <p className="mt-2 text-[13px] text-ink/55">
                    <Link to="/auth" className="font-medium text-brand">
                      Log in
                    </Link>{" "}
                    to offer this seeker a property.
                  </p>
                )}
                {isOwner && (
                  <p className="mt-2 text-[13px] text-ink/55">
                    This is your ad — check{" "}
                    <Link to="/dashboard" className="font-medium text-brand">
                      My activity
                    </Link>{" "}
                    for applications.
                  </p>
                )}
                {user && !isOwner && myApplication.data && (
                  <p className="mt-2 text-[13px] text-ink/60">
                    You've applied. Status:{" "}
                    <strong className="text-ink">{myApplication.data.status}</strong>
                  </p>
                )}
                {user && !isOwner && !myApplication.data && (
                  <form onSubmit={apply} className="mt-3 space-y-3">
                    <select
                      value={listingId}
                      onChange={(e) => setListingId(e.target.value)}
                      className="w-full rounded-[10px] bg-ink/[0.04] px-3 py-2 text-sm outline-none ring-1 ring-transparent focus:ring-brand/40"
                    >
                      <option value="">No specific listing</option>
                      {myListings.data?.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.title} — {l.suburb}
                        </option>
                      ))}
                    </select>
                    <textarea
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      required
                      rows={4}
                      placeholder="Tell them why your place matches their brief."
                      className="w-full rounded-[10px] bg-ink/[0.04] px-3 py-2 text-sm outline-none ring-1 ring-transparent placeholder:text-ink/35 focus:ring-brand/40"
                    />
                    <button className="w-full rounded-[10px] bg-brand px-4 py-2.5 text-sm font-semibold text-brand-foreground hover:bg-brand/90">
                      Send application
                    </button>
                  </form>
                )}
              </div>

              {coords && (
                <div className="h-64">
                  <BlueprintMap
                    pins={[
                      {
                        id: w.id,
                        lat: coords.lat,
                        lng: coords.lng,
                        label: w.suburbs[0] ?? "Sydney",
                        kind: "wanted",
                      },
                    ]}
                    activeId={w.id}
                  />
                </div>
              )}
            </aside>
          </div>
        )}
      </main>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-ink/40">{label}</p>
      <p className="mt-0.5 font-display text-[15px] font-semibold">{value}</p>
    </div>
  );
}
