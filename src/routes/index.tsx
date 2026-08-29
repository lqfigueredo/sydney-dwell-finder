import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/AppHeader";
import { BlueprintMap, type MapPin } from "@/components/BlueprintMap";
import {
  coordsFor,
  priceShort,
  formatPrice,
  PROPERTY_KINDS,
  propertyKindLabel,
  type Deal,
  type Listing,
  type PropertyKind,
  type WantedAd,
} from "@/lib/marketplace";


export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Tidewater — Sydney property, both ways" },
      {
        name: "description",
        content:
          "Browse Sydney rentals and sales on a live map, or post what you're looking for and let owners apply to you.",
      },
      { property: "og:title", content: "Tidewater — Sydney property, both ways" },
      {
        property: "og:description",
        content:
          "Map-first Sydney marketplace: listings from owners, wanted ads from seekers, applications in both directions.",
      },
    ],
  }),
  component: Browse,
});

function Browse() {
  const [mode, setMode] = useState<"properties" | "wanted">("properties");
  const navigate = useNavigate();
  const [deal, setDeal] = useState<Deal | "all">("all");
  const [query, setQuery] = useState("");
  const [beds, setBeds] = useState(0);
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [types, setTypes] = useState<PropertyKind[]>([]);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);

  const minCents = minPrice ? Number(minPrice) * 100 : null;
  const maxCents = maxPrice ? Number(maxPrice) * 100 : null;
  const inPrice = (cents: number) =>
    (minCents == null || cents >= minCents) && (maxCents == null || cents <= maxCents);

  const toggleType = (t: PropertyKind) =>
    setTypes((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));

  const advancedCount =
    (minPrice ? 1 : 0) + (maxPrice ? 1 : 0) + (types.length ? 1 : 0) + (beds > 0 ? 1 : 0);

  const resetAdvanced = () => {
    setMinPrice("");
    setMaxPrice("");
    setTypes([]);
    setBeds(0);
  };


  const listings = useQuery({
    queryKey: ["listings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("listings")
        .select("*")
        .eq("published", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Listing[];
    },
  });

  const wanted = useQuery({
    queryKey: ["wanted"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wanted_ads")
        .select("*")
        .eq("open", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as WantedAd[];
    },
  });

  const q = query.trim().toLowerCase();

  const visibleListings = useMemo(
    () =>
      (listings.data ?? []).filter(
        (l) =>
          (deal === "all" || l.deal === deal) &&
          l.bedrooms >= beds &&
          inPrice(l.price_cents) &&
          (types.length === 0 || types.includes(l.property_type)) &&
          (!q ||
            l.title.toLowerCase().includes(q) ||
            l.suburb.toLowerCase().includes(q) ||
            l.address.toLowerCase().includes(q)),
      ),
    [listings.data, deal, beds, q, minCents, maxCents, types],
  );

  const visibleWanted = useMemo(
    () =>
      (wanted.data ?? []).filter(
        (w) =>
          (deal === "all" || w.deal === deal) &&
          w.bedrooms_min >= beds &&
          inPrice(w.budget_cents) &&
          (types.length === 0 ||
            w.property_types.length === 0 ||
            w.property_types.some((t) => types.includes(t))) &&
          (!q ||
            w.title.toLowerCase().includes(q) ||
            w.suburbs.join(" ").toLowerCase().includes(q)),
      ),
    [wanted.data, deal, beds, q, minCents, maxCents, types],
  );


  const pins: MapPin[] = useMemo(() => {
    const source =
      mode === "wanted"
        ? visibleWanted.map((w) => ({
            id: w.id,
            coords: coordsFor(w),
            label: priceShort(w.deal, w.budget_cents),
            kind: "wanted" as const,
          }))
        : visibleListings.map((l) => ({
            id: l.id,
            coords: coordsFor(l),
            label: priceShort(l.deal, l.price_cents),
            kind: "offered" as const,
          }));
    return source
      .filter((s) => s.coords)
      .map((s) => ({ id: s.id, label: s.label, kind: s.kind, ...s.coords! }));
  }, [mode, visibleListings, visibleWanted]);

  const loading = mode === "wanted" ? wanted.isLoading : listings.isLoading;
  const count = mode === "wanted" ? visibleWanted.length : visibleListings.length;

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <AppHeader mode={mode} />

      <div className="mx-auto max-w-[1440px] px-6 pt-5">
        <div className="flex flex-wrap items-center gap-2 rounded-xl bg-canvas p-2 ring-1 ring-ink/10">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search suburb, street or keyword"
            className="min-w-[220px] flex-1 rounded-[10px] bg-ink/[0.04] px-3.5 py-2 text-sm outline-none ring-1 ring-transparent placeholder:text-ink/35 focus:ring-brand/40"
          />
          <Segmented
            value={deal}
            onChange={setDeal}
            options={[
              { value: "all", label: "All" },
              { value: "rent", label: "Rent" },
              { value: "buy", label: "Buy" },
            ]}
          />
          <Segmented
            value={String(beds)}
            onChange={(v) => setBeds(Number(v))}
            options={[
              { value: "0", label: "Any beds" },
              { value: "1", label: "1+" },
              { value: "2", label: "2+" },
              { value: "3", label: "3+" },
            ]}
          />
          <button
            onClick={() => setShowAdvanced((s) => !s)}
            aria-expanded={showAdvanced}
            className={`rounded-[10px] px-3.5 py-2 text-sm font-medium ring-1 ${
              showAdvanced || advancedCount
                ? "bg-ink/[0.06] text-ink ring-ink/20"
                : "text-ink/60 ring-ink/10 hover:bg-ink/[0.04]"
            }`}
          >
            More filters
            {advancedCount > 0 && (
              <span className="ml-2 rounded-full bg-brand px-1.5 py-0.5 text-[10px] font-semibold text-brand-foreground">
                {advancedCount}
              </span>
            )}
          </button>
          <Link
            to="/post-wanted"
            className="rounded-[10px] px-3.5 py-2 text-sm font-medium text-brand ring-1 ring-brand/25 hover:bg-brand/5"
          >
            Post what you want
          </Link>
        </div>

        {showAdvanced && (
          <div className="mt-2 flex flex-wrap items-end gap-4 rounded-xl bg-canvas p-4 ring-1 ring-ink/10">
            <div>
              <span className="block text-[11px] font-medium uppercase tracking-[0.14em] text-ink/45">
                {mode === "wanted" ? "Budget" : "Price"}{" "}
                {deal === "rent" ? "per week (AUD)" : "(AUD)"}
              </span>
              <div className="mt-1.5 flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  value={minPrice}
                  onChange={(e) => setMinPrice(e.target.value)}
                  placeholder="Min"
                  className="w-28 rounded-[10px] bg-ink/[0.04] px-3 py-2 text-sm outline-none ring-1 ring-transparent placeholder:text-ink/35 focus:ring-brand/40"
                />
                <span className="text-ink/35">–</span>
                <input
                  type="number"
                  min={0}
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(e.target.value)}
                  placeholder="Max"
                  className="w-28 rounded-[10px] bg-ink/[0.04] px-3 py-2 text-sm outline-none ring-1 ring-transparent placeholder:text-ink/35 focus:ring-brand/40"
                />
              </div>
            </div>

            <div>
              <span className="block text-[11px] font-medium uppercase tracking-[0.14em] text-ink/45">
                Property type
              </span>
              <div className="mt-1.5 flex flex-wrap gap-2">
                {PROPERTY_KINDS.map((k) => {
                  const on = types.includes(k.value);
                  return (
                    <button
                      key={k.value}
                      type="button"
                      aria-pressed={on}
                      onClick={() => toggleType(k.value)}
                      className={`rounded-full px-3 py-1.5 text-[12px] font-medium ring-1 ${
                        on
                          ? "bg-brand/10 text-brand ring-brand/30"
                          : "bg-ink/[0.03] text-ink/60 ring-ink/10"
                      }`}
                    >
                      {k.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {advancedCount > 0 && (
              <button
                onClick={resetAdvanced}
                className="ml-auto rounded-[10px] px-3 py-2 text-sm font-medium text-ink/55 hover:bg-ink/[0.04]"
              >
                Clear filters
              </button>
            )}
          </div>
        )}
      </div>


      <main className="mx-auto grid max-w-[1440px] grid-cols-12 gap-5 px-6 py-5">
        <section className="col-span-12 lg:col-span-5 xl:col-span-4">
          <div className="mb-3 flex items-baseline justify-between">
            <h1 className="font-display text-lg font-semibold">
              {mode === "wanted" ? "People looking" : "Properties available"}
            </h1>
            <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-ink/40">
              {loading ? "loading" : `${count} results`}
            </span>
          </div>

          <div className="flex max-h-[calc(100vh-230px)] flex-col gap-3 overflow-y-auto pr-1">
            {loading &&
              [0, 1, 2].map((i) => (
                <div key={i} className="h-28 animate-pulse rounded-xl bg-ink/5" />
              ))}

            {!loading && count === 0 && (
              <p className="rounded-xl bg-ink/[0.03] p-6 text-sm text-ink/55 ring-1 ring-ink/10">
                Nothing matches those filters yet.
              </p>
            )}

            {mode === "properties"
              ? visibleListings.map((l) => (
                  <ListingCard
                    key={l.id}
                    listing={l}
                    active={activeId === l.id}
                    onHover={() => setActiveId(l.id)}
                  />
                ))
              : visibleWanted.map((w) => (
                  <WantedCard
                    key={w.id}
                    ad={w}
                    active={activeId === w.id}
                    onHover={() => setActiveId(w.id)}
                  />
                ))}
          </div>
        </section>

        <section className="col-span-12 lg:col-span-7 xl:col-span-8">
          <div className="h-[520px] lg:h-[calc(100vh-200px)]">
            <BlueprintMap
              pins={pins}
              activeId={activeId}
              onSelect={(id) => {
                setActiveId(id);
                void navigate(
                  mode === "wanted"
                    ? { to: "/wanted/$id", params: { id } }
                    : { to: "/listings/$id", params: { id } },
                );
              }}
            />
          </div>
        </section>
      </main>
    </div>
  );
}

function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div className="flex rounded-[10px] bg-ink/[0.04] p-1">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`rounded-[8px] px-3 py-1.5 text-[13px] font-medium ${
            value === o.value ? "bg-canvas text-ink ring-1 ring-ink/10" : "text-ink/50"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function ListingCard({
  listing,
  active,
  onHover,
}: {
  listing: Listing;
  active: boolean;
  onHover: () => void;
}) {
  return (
    <Link
      to="/listings/$id"
      params={{ id: listing.id }}
      onMouseEnter={onHover}
      className={`group grid grid-cols-[92px_1fr] gap-3 rounded-xl bg-canvas p-3 ring-1 transition-colors ${
        active ? "ring-brand/45" : "ring-ink/10 hover:ring-ink/25"
      }`}
    >
      <div className="blueprint-grid grid aspect-square place-items-center overflow-hidden rounded-[10px] bg-ink/[0.04] ring-1 ring-ink/10">
        {listing.cover_url ? (
          <img
            src={listing.cover_url}
            alt={listing.title}
            loading="lazy"
            className="size-full object-cover"
          />
        ) : (
          <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-ink/30">
            {listing.suburb.slice(0, 3)}
          </span>
        )}
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-accent/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-ink/70">
            {listing.deal === "rent" ? "For rent" : "For sale"}
          </span>
          <span className="truncate text-[12px] text-ink/45">
            {propertyKindLabel(listing.property_type)} · {listing.suburb}
          </span>

        </div>
        <h3 className="mt-1 truncate font-display text-[15px] font-semibold">{listing.title}</h3>
        <p className="truncate text-[12px] text-ink/50">{listing.address}</p>
        <div className="mt-2 flex items-center gap-3 text-[12px] text-ink/60">
          <span className="font-display text-[15px] font-semibold text-ink">
            {priceShort(listing.deal, listing.price_cents)}
          </span>
          <span>{listing.bedrooms} bd</span>
          <span>{listing.bathrooms} ba</span>
          {listing.parking > 0 && <span>{listing.parking} car</span>}
        </div>
      </div>
    </Link>
  );
}

function WantedCard({
  ad,
  active,
  onHover,
}: {
  ad: WantedAd;
  active: boolean;
  onHover: () => void;
}) {
  return (
    <Link
      to="/wanted/$id"
      params={{ id: ad.id }}
      onMouseEnter={onHover}
      className={`rounded-xl bg-brand/[0.04] p-4 ring-1 transition-colors ${
        active ? "ring-brand/50" : "ring-brand/15 hover:ring-brand/35"
      }`}
    >
      <div className="flex items-center gap-2">
        <span className="rounded-full bg-brand/12 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-brand">
          Wanted · {ad.deal === "rent" ? "rental" : "purchase"}
        </span>
      </div>
      <h3 className="mt-2 font-display text-[15px] font-semibold">{ad.title}</h3>
      <p className="mt-1 line-clamp-2 text-[12px] text-ink/55">
        {ad.suburbs.join(" · ") || "Anywhere in Sydney"}
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-3 text-[12px] text-ink/60">
        <span className="font-display text-[15px] font-semibold text-brand">
          up to {formatPrice(ad.deal, ad.budget_cents)}
          {ad.deal === "rent" ? "/wk" : ""}
        </span>
        <span>{ad.bedrooms_min}+ bd</span>
        {ad.move_in_date && <span>from {ad.move_in_date}</span>}
      </div>
    </Link>
  );
}
