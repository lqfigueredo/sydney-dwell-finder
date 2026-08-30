import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/AppHeader";
import { CommentThread } from "@/components/CommentThread";
import { GoogleMap } from "@/components/GoogleMap";
import { formatPrice, priceSuffix, type Listing } from "@/lib/marketplace";
import { getPrivateListingPhotos, getPublicListingPhotos } from "@/lib/photos.functions";
import { VerifiedSeal } from "@/components/VerifiedSeal";

export const Route = createFileRoute("/listings/$id")({
  head: () => ({
    meta: [
      { title: "Property detail — SydHub Sydney" },
      {
        name: "description",
        content:
          "Photos, features, location and neighbour comments for this Sydney property on SydHub.",
      },
      { property: "og:title", content: "Property detail — SydHub Sydney" },
      {
        property: "og:description",
        content: "Photos, features, location and comments for this Sydney property.",
      },
    ],
  }),
  component: ListingDetail,
});

function ListingDetail() {
  const { id } = Route.useParams();

  const listing = useQuery({
    queryKey: ["listing", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("listings").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data as Listing | null;
    },
  });

  // Photos live in a private bucket; the server only mints links once the
  // listing has cleared moderation.
  const photos = useQuery({
    queryKey: ["listing-photos", id],
    queryFn: async () => {
      console.error("photos start", id);
      const pub = await getPublicListingPhotos({ data: { listingId: id } });
      console.error("pub", JSON.stringify(pub));
      if (pub.cover || pub.photos.length) return pub;
      // Owners and moderators can preview photos that are still under review.
      const { data: auth } = await supabase.auth.getSession();
      console.error("session?", !!auth.session);
      if (!auth.session) return pub;
      try {
        return await getPrivateListingPhotos({ data: { listingId: id } });
      } catch (e) {
        console.error("private photos failed", e);
        return pub;
      }
    },
  });

  const l = listing.data;

  const owner = useQuery({
    queryKey: ["listing-owner", l?.owner_id],
    enabled: !!l?.owner_id,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("display_name, verified_at")
        .eq("id", l!.owner_id!)
        .maybeSingle();
      return data;
    },
  });

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <AppHeader mode="properties" />
      <main className="mx-auto max-w-[1200px] px-6 py-8">
        <Link to="/" className="text-[12px] font-medium text-ink/45 hover:text-ink">
          ← Back to the map
        </Link>

        {listing.isLoading && <div className="mt-6 h-64 animate-pulse rounded-xl bg-ink/5" />}
        {!listing.isLoading && !l && (
          <p className="mt-6 rounded-xl bg-ink/[0.03] p-8 text-sm text-ink/55 ring-1 ring-ink/10">
            This listing is no longer available.
          </p>
        )}

        {l && (
          <>
            <div className="mt-4 grid grid-cols-12 gap-5">
              <div className="col-span-12 lg:col-span-8">
                <div className="blueprint-grid grid aspect-[16/9] place-items-center overflow-hidden rounded-xl ring-1 ring-ink/10">
                  {photos.data?.cover ? (
                    <img
                      src={photos.data.cover}
                      alt={l.title}
                      className="size-full object-cover"
                    />
                  ) : (
                    <span className="text-[11px] font-medium uppercase tracking-[0.2em] text-ink/30">
                      No photo yet
                    </span>
                  )}
                </div>

                {(photos.data?.photos.length ?? 0) > 0 && (
                  <div className="mt-3 grid grid-cols-4 gap-3">
                    {photos.data!.photos.map((p) => (
                      <img
                        key={p.id}
                        src={p.url}
                        alt=""
                        loading="lazy"
                        className="aspect-square w-full rounded-[10px] object-cover ring-1 ring-ink/10"
                      />
                    ))}
                  </div>
                )}

                <div className="mt-6">
                  <span className="rounded-full bg-accent/20 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink/70">
                    {l.deal === "rent" ? "For rent" : "For sale"}
                  </span>
                  <h1 className="mt-3 font-display text-3xl font-semibold">{l.title}</h1>
                  <p className="mt-1 text-sm text-ink/55">
                    {l.address}, {l.suburb} {l.postcode ?? ""}
                  </p>
                  {owner.data && (
                    <p className="mt-2 flex items-center gap-2 text-[13px] text-ink/60">
                      Listed by {owner.data.display_name || "a SydHub member"}
                      {owner.data.verified_at && <VerifiedSeal />}
                    </p>
                  )}

                  <div className="mt-5 flex flex-wrap gap-2 text-[13px]">
                    {[
                      `${l.bedrooms} bedrooms`,
                      `${l.bathrooms} bathrooms`,
                      `${l.parking} parking`,
                      l.area_sqm ? `${l.area_sqm} m²` : null,
                    ]
                      .filter(Boolean)
                      .map((s) => (
                        <span
                          key={s as string}
                          className="rounded-[8px] bg-ink/[0.04] px-3 py-1.5 font-medium text-ink/70"
                        >
                          {s}
                        </span>
                      ))}
                  </div>

                  <p className="mt-5 whitespace-pre-line text-sm leading-relaxed text-ink/75">
                    {l.description}
                  </p>

                  {l.features.length > 0 && (
                    <ul className="mt-5 grid grid-cols-2 gap-2 text-[13px] text-ink/70 sm:grid-cols-3">
                      {l.features.map((f) => (
                        <li key={f} className="flex items-center gap-2">
                          <span className="size-1.5 rounded-full bg-brand" />
                          {f}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="mt-8">
                  <CommentThread target={{ listingId: l.id }} />
                </div>
              </div>

              <aside className="col-span-12 space-y-4 lg:col-span-4">
                <div className="rounded-xl bg-canvas p-5 ring-1 ring-ink/10">
                  <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-ink/40">
                    {priceSuffix(l.deal)}
                  </p>
                  <p className="mt-1 font-display text-3xl font-semibold text-brand">
                    {formatPrice(l.deal, l.price_cents)}
                    {l.deal === "rent" && (
                      <span className="text-base font-medium text-ink/45"> /week</span>
                    )}
                  </p>
                  <Link
                    to="/post-wanted"
                    className="mt-4 block rounded-[10px] bg-brand px-4 py-2.5 text-center text-sm font-semibold text-brand-foreground hover:bg-brand/90"
                  >
                    Post what you're after
                  </Link>
                </div>

                {l.lat != null && l.lng != null && (
                  <div className="h-64">
                    <GoogleMap
                      markers={[
                        {
                          id: l.id,
                          lat: l.lat,
                          lng: l.lng,
                          kind: "offered",
                          title: l.title,
                          price: formatPrice(l.deal, l.price_cents),
                          label: `${l.address}, ${l.suburb}`,
                          link: `/listings/${l.id}`,
                        },
                      ]}
                      activeId={l.id}
                      fitBounds={false}
                      zoom={15}
                    />
                  </div>
                )}
              </aside>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
