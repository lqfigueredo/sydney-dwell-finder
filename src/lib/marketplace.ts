import type { Database } from "@/integrations/supabase/types";

export type Listing = Database["public"]["Tables"]["listings"]["Row"];
export type WantedAd = Database["public"]["Tables"]["wanted_ads"]["Row"];
export type Comment = Database["public"]["Tables"]["comments"]["Row"];
export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type Application = Database["public"]["Tables"]["applications"]["Row"];
export type Deal = Database["public"]["Enums"]["deal_kind"];

const aud = new Intl.NumberFormat("en-AU", {
  style: "currency",
  currency: "AUD",
  maximumFractionDigits: 0,
});

/** Rent is stored as cents per week, sale prices as cents total. */
export function formatPrice(deal: Deal, cents: number): string {
  if (deal === "rent") return aud.format(Math.round(cents / 100));
  const dollars = cents / 100;
  if (dollars >= 1_000_000) return `${aud.format(dollars / 1_000_000).replace(/\.00$/, "")}M`;
  return aud.format(dollars);
}

export function priceSuffix(deal: Deal): string {
  return deal === "rent" ? "per week" : "guide";
}

export function priceShort(deal: Deal, cents: number): string {
  return deal === "rent" ? `${formatPrice(deal, cents)}/wk` : formatPrice(deal, cents);
}

export const SYDNEY_CENTRE = { lat: -33.87, lng: 151.14 };

/** Rough coordinates for suburbs used when a wanted ad has no pin of its own. */
export const SUBURB_COORDS: Record<string, { lat: number; lng: number }> = {
  Bondi: { lat: -33.8915, lng: 151.2767 },
  "Surry Hills": { lat: -33.8845, lng: 151.2118 },
  Newtown: { lat: -33.8983, lng: 151.1793 },
  Manly: { lat: -33.7969, lng: 151.2874 },
  Glebe: { lat: -33.8794, lng: 151.1866 },
  Paddington: { lat: -33.8859, lng: 151.2276 },
  Marrickville: { lat: -33.9106, lng: 151.1552 },
  "Dulwich Hill": { lat: -33.9046, lng: 151.1387 },
  Balmain: { lat: -33.8578, lng: 151.1798 },
  Redfern: { lat: -33.8932, lng: 151.2043 },
  Chatswood: { lat: -33.7969, lng: 151.1832 },
  Parramatta: { lat: -33.815, lng: 151.0011 },
  Freshwater: { lat: -33.7787, lng: 151.2874 },
  "Curl Curl": { lat: -33.7686, lng: 151.2929 },
  Coogee: { lat: -33.9205, lng: 151.2554 },
  Pyrmont: { lat: -33.869, lng: 151.194 },
  Annandale: { lat: -33.8815, lng: 151.1701 },
  Drummoyne: { lat: -33.8524, lng: 151.1544 },
  "Sydney CBD": { lat: -33.8688, lng: 151.2093 },
};

export const SUBURB_NAMES = Object.keys(SUBURB_COORDS).sort();

export function coordsFor(item: {
  lat: number | null;
  lng: number | null;
  suburbs?: string[] | null;
}): { lat: number; lng: number } | null {
  if (item.lat != null && item.lng != null) return { lat: item.lat, lng: item.lng };
  const first = item.suburbs?.find((s) => SUBURB_COORDS[s]);
  return first ? (SUBURB_COORDS[first] ?? null) : null;
}

export function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? "")
      .join("") || "?"
  );
}

export type PropertyKind = Database["public"]["Enums"]["property_kind"];

export const PROPERTY_KINDS: { value: PropertyKind; label: string }[] = [
  { value: "apartment", label: "Apartment" },
  { value: "house", label: "House" },
  { value: "townhouse", label: "Townhouse" },
  { value: "studio", label: "Studio" },
  { value: "land", label: "Land" },
];

export function propertyKindLabel(kind: PropertyKind): string {
  return PROPERTY_KINDS.find((k) => k.value === kind)?.label ?? kind;
}
