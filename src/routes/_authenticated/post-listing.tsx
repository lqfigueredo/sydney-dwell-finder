import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { AppHeader } from "@/components/AppHeader";
import { GoogleMap, geocodeAddress, loadGoogleMaps } from "@/components/GoogleMap";

import {
  PROPERTY_KINDS,
  SUBURB_COORDS,
  SUBURB_NAMES,
  SYDNEY_CENTRE,
  type Deal,
  type PropertyKind,
} from "@/lib/marketplace";

export const Route = createFileRoute("/_authenticated/post-listing")({
  head: () => ({
    meta: [
      { title: "List a property — SydHub Sydney" },
      {
        name: "description",
        content:
          "Publish a Sydney rental or sale with photos, features and a pin on the SydHub map.",
      },
      { property: "og:title", content: "List a property — SydHub Sydney" },
      {
        property: "og:description",
        content: "Publish a Sydney rental or sale with photos and a map pin.",
      },
    ],
  }),
  component: PostListing,
});

const FEATURES = [
  "Balcony",
  "Air conditioning",
  "Dishwasher",
  "Pets allowed",
  "Furnished",
  "Gym",
  "Pool",
  "Study",
  "Storage",
  "Water views",
];

function PostListing() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    deal: "rent" as Deal,
    title: "",
    address: "",
    suburb: "Surry Hills",
    postcode: "",
    price: "",
    property_type: "apartment" as PropertyKind,
    bedrooms: 2,
    bathrooms: 1,
    parking: 0,
    area: "",
    description: "",
  });
  const [features, setFeatures] = useState<string[]>([]);
  const [pin, setPin] = useState<{ lat: number; lng: number } | null>(
    SUBURB_COORDS["Surry Hills"] ?? null,
  );
  // "address" = pin follows what the user typed; "manual" = they moved it themselves.
  const [pinSource, setPinSource] = useState<"address" | "manual">("address");
  const [geoState, setGeoState] = useState<{
    status: "idle" | "loading" | "found" | "notfound";
    label?: string;
  }>({ status: "idle" });
  const addressRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  // Google Places suggestions on the street address field (Australia only).
  useEffect(() => {
    let autocomplete: any;
    let cancelled = false;
    loadGoogleMaps()
      .then((google: any) => {
        if (cancelled || !google?.maps?.places || !addressRef.current) return;
        autocomplete = new google.maps.places.Autocomplete(addressRef.current, {
          componentRestrictions: { country: "au" },
          fields: ["address_components", "formatted_address", "geometry", "name"],
        });
        autocomplete.addListener("place_changed", () => {
          const place = autocomplete.getPlace();
          if (!place?.geometry?.location) return;
          const comps: any[] = place.address_components ?? [];
          const streetNumber = comps.find((c) => c.types.includes("street_number"))?.short_name;
          const route = comps.find((c) => c.types.includes("route"))?.long_name;
          const locality = comps.find(
            (c) => c.types.includes("locality") || c.types.includes("sublocality"),
          )?.long_name;
          const postcode = comps.find((c) => c.types.includes("postal_code"))?.long_name;

          setForm((f) => ({
            ...f,
            address: [streetNumber, route].filter(Boolean).join(" ") || place.name || f.address,
            ...(locality && SUBURB_NAMES.includes(locality) ? { suburb: locality } : {}),
            ...(postcode ? { postcode } : {}),
          }));
          setPinSource("address");
          setPin({ lat: place.geometry.location.lat(), lng: place.geometry.location.lng() });
          setGeoState({ status: "found", label: place.formatted_address ?? "" });
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      const google = (window as any).google;
      if (autocomplete && google?.maps?.event) {
        google.maps.event.clearInstanceListeners(autocomplete);
      }
    };
  }, []);

  // Whenever the typed address changes, re-pin to that address (debounced).
  useEffect(() => {
    if (pinSource !== "address") return;
    const address = form.address.trim();
    if (!address) {
      setGeoState({ status: "idle" });
      setPin(SUBURB_COORDS[form.suburb] ?? null);
      return;
    }
    const query = `${address}, ${form.suburb} NSW ${form.postcode ?? ""}, Australia`;
    setGeoState({ status: "loading" });
    const timer = setTimeout(async () => {
      const result = await geocodeAddress(query);
      if (result) {
        setPin({ lat: result.lat, lng: result.lng });
        setGeoState({ status: "found", label: result.formattedAddress });
      } else {
        setPin(SUBURB_COORDS[form.suburb] ?? null);
        setGeoState({ status: "notfound" });
      }
    }, 700);
    return () => clearTimeout(timer);
  }, [form.address, form.suburb, form.postcode, pinSource]);


  /**
   * Photos stay private in storage — we keep only the object path. Short-lived
   * signed links are minted at view time once moderation has cleared the listing.
   */
  const uploadPhotos = async (listingId: string) => {
    const paths: string[] = [];
    for (const [i, file] of files.entries()) {
      if (!file.type.startsWith("image/")) {
        toast.error(`${file.name} is not an image`);
        continue;
      }
      if (file.size > 8 * 1024 * 1024) {
        toast.error(`${file.name} is larger than 8 MB`);
        continue;
      }
      const path = `${user!.id}/${listingId}/${Date.now()}-${i}-${file.name.replace(/[^\w.-]/g, "_")}`;
      const { error } = await supabase.storage
        .from("property-photos")
        .upload(path, file, { contentType: file.type });
      if (error) {
        toast.error(`Photo upload failed: ${error.message}`);
        continue;
      }
      paths.push(path);
    }
    return paths;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setBusy(true);
    try {
      const priceCents = Math.round(Number(form.price || 0) * 100);
      const { data, error } = await supabase
        .from("listings")
        .insert({
          owner_id: user.id,
          deal: form.deal,
          title: form.title,
          address: form.address,
          suburb: form.suburb,
          postcode: form.postcode || null,
          lat: pin?.lat ?? null,
          lng: pin?.lng ?? null,
          price_cents: priceCents,
          property_type: form.property_type,
          bedrooms: form.bedrooms,
          bathrooms: form.bathrooms,
          parking: form.parking,
          area_sqm: form.area ? Number(form.area) : null,
          description: form.description,
          features,
        })
        .select("id, moderation_status")
        .single();
      if (error) throw error;

      if (files.length) {
        const paths = await uploadPhotos(data.id);
        if (paths.length) {
          await supabase.from("listings").update({ cover_url: paths[0] ?? null }).eq("id", data.id);
          await supabase
            .from("listing_photos")
            .insert(paths.map((url, i) => ({ listing_id: data.id, url, sort_order: i })));
        }
      }

      toast.success(
        data.moderation_status === "approved"
          ? "Published — your verified seal skipped the review queue."
          : "Submitted — a moderator will review your listing and photos shortly.",
      );
      void navigate({ to: "/listings/$id", params: { id: data.id } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not publish listing");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <AppHeader mode="properties" />
      <main className="mx-auto max-w-[1100px] px-6 py-8">
        <h1 className="font-display text-3xl font-semibold">List a property</h1>
        <p className="mt-1 text-sm text-ink/55">
          Drop a pin on the map so seekers find you in the right pocket of Sydney.
        </p>

        <form onSubmit={submit} className="mt-6 grid grid-cols-12 gap-5">
          <div className="col-span-12 space-y-4 lg:col-span-7">
            <div className="rounded-xl bg-canvas p-5 ring-1 ring-ink/10">
              <div className="flex rounded-[10px] bg-ink/[0.04] p-1">
                {(["rent", "buy"] as Deal[]).map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => set("deal", d)}
                    className={`flex-1 rounded-[8px] px-3 py-1.5 text-sm font-medium ${
                      form.deal === d ? "bg-canvas ring-1 ring-ink/10" : "text-ink/50"
                    }`}
                  >
                    {d === "rent" ? "For rent" : "For sale"}
                  </button>
                ))}
              </div>

              <div className="mt-4 space-y-3">
                <Field
                  label="Headline"
                  value={form.title}
                  onChange={(v) => set("title", v)}
                  placeholder="Light-filled 2 bed near the park"
                  required
                />
                <Field
                  label="Street address"
                  value={form.address}
                  onChange={(v) => {
                    set("address", v);
                    setPinSource("address");
                  }}
                  placeholder="12/48 Bourke Street"
                  required
                  inputRef={addressRef}
                />
                <div className="grid grid-cols-2 gap-3">
                  <label className="block">
                    <Label>Suburb</Label>
                    <select
                      value={form.suburb}
                      onChange={(e) => {
                        set("suburb", e.target.value);
                        setPinSource("address");
                        if (!form.address.trim()) {
                          setPin(SUBURB_COORDS[e.target.value] ?? null);
                        }
                      }}
                      className="mt-1 w-full rounded-[10px] bg-ink/[0.04] px-3 py-2 text-sm outline-none ring-1 ring-transparent focus:ring-brand/40"
                    >

                      {SUBURB_NAMES.map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                  </label>
                  <Field
                    label="Postcode"
                    value={form.postcode}
                    onChange={(v) => set("postcode", v)}
                    placeholder="2010"
                  />
                </div>
                <Field
                  label={form.deal === "rent" ? "Rent per week (AUD)" : "Asking price (AUD)"}
                  value={form.price}
                  onChange={(v) => set("price", v)}
                  type="number"
                  placeholder={form.deal === "rent" ? "780" : "1250000"}
                  required
                />
                <label className="block">
                  <Label>Property type</Label>
                  <select
                    value={form.property_type}
                    onChange={(e) => set("property_type", e.target.value as PropertyKind)}
                    className="mt-1 w-full rounded-[10px] bg-ink/[0.04] px-3 py-2 text-sm outline-none ring-1 ring-transparent focus:ring-brand/40"
                  >
                    {PROPERTY_KINDS.map((k) => (
                      <option key={k.value} value={k.value}>
                        {k.label}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="grid grid-cols-4 gap-3">
                  <Field
                    label="Beds"
                    type="number"
                    value={String(form.bedrooms)}
                    onChange={(v) => set("bedrooms", Number(v))}
                  />
                  <Field
                    label="Baths"
                    type="number"
                    value={String(form.bathrooms)}
                    onChange={(v) => set("bathrooms", Number(v))}
                  />
                  <Field
                    label="Cars"
                    type="number"
                    value={String(form.parking)}
                    onChange={(v) => set("parking", Number(v))}
                  />
                  <Field
                    label="m²"
                    type="number"
                    value={form.area}
                    onChange={(v) => set("area", v)}
                  />
                </div>
                <label className="block">
                  <Label>Description</Label>
                  <textarea
                    rows={5}
                    value={form.description}
                    onChange={(e) => set("description", e.target.value)}
                    placeholder="What makes this place worth a look?"
                    className="mt-1 w-full rounded-[10px] bg-ink/[0.04] px-3 py-2 text-sm outline-none ring-1 ring-transparent placeholder:text-ink/35 focus:ring-brand/40"
                  />
                </label>
              </div>
            </div>

            <div className="rounded-xl bg-canvas p-5 ring-1 ring-ink/10">
              <Label>Features</Label>
              <div className="mt-2 flex flex-wrap gap-2">
                {FEATURES.map((f) => {
                  const on = features.includes(f);
                  return (
                    <button
                      key={f}
                      type="button"
                      onClick={() =>
                        setFeatures((prev) =>
                          on ? prev.filter((x) => x !== f) : [...prev, f],
                        )
                      }
                      className={`rounded-full px-3 py-1.5 text-[12px] font-medium ring-1 ${
                        on
                          ? "bg-brand/10 text-brand ring-brand/30"
                          : "bg-ink/[0.03] text-ink/60 ring-ink/10"
                      }`}
                    >
                      {f}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="rounded-xl bg-canvas p-5 ring-1 ring-ink/10">
              <Label>Photos</Label>
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
                className="mt-2 block w-full text-sm text-ink/60 file:mr-3 file:rounded-[8px] file:border-0 file:bg-ink/[0.06] file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-ink/70"
              />
              {files.length > 0 && (
                <p className="mt-2 text-[12px] text-ink/50">
                  {files.length} photo{files.length > 1 ? "s" : ""} ready — the first becomes the
                  cover.
                </p>
              )}
            </div>
          </div>

          <div className="col-span-12 space-y-4 lg:col-span-5">
            <div className="rounded-xl bg-canvas p-5 ring-1 ring-ink/10">
              <Label>Location on the map</Label>
              <p className="mt-1 text-[12px] text-ink/45">
                The pin follows the street address you enter. You can still click or drag it to
                fine-tune.
              </p>
              <div className="mt-3 h-[380px]">
                <GoogleMap
                  center={pin ?? SYDNEY_CENTRE}
                  zoom={pin ? 16 : 13}
                  markers={[]}
                  fitBounds={false}
                  onMapClick={(lat, lng) => {
                    setPinSource("manual");
                    setPin({ lat, lng });
                  }}
                  {...(pin
                    ? {
                        draggableMarker: {
                          lat: pin.lat,
                          lng: pin.lng,
                          onDragEnd: (lat: number, lng: number) => {
                            setPinSource("manual");
                            setPin({ lat, lng });
                          },
                        },
                      }
                    : {})}
                />
              </div>
              <div className="mt-2 flex items-center justify-between gap-3 text-[12px]">
                <span className="text-ink/55">
                  {pinSource === "manual"
                    ? "Pin placed manually."
                    : geoState.status === "loading"
                      ? "Locating address…"
                      : geoState.status === "found"
                        ? `Pinned to ${geoState.label}`
                        : geoState.status === "notfound"
                          ? "We couldn't find that address — drag the pin to the right spot."
                          : "Enter a street address to place the pin."}
                </span>
                {pinSource === "manual" && (
                  <button
                    type="button"
                    onClick={() => setPinSource("address")}
                    className="shrink-0 font-semibold text-brand hover:underline"
                  >
                    Reset to address
                  </button>
                )}
              </div>
            </div>


            <button
              disabled={busy}
              className="w-full rounded-[10px] bg-brand px-4 py-3 text-sm font-semibold text-brand-foreground hover:bg-brand/90 disabled:opacity-60"
            >
              {busy ? "Publishing…" : "Publish listing"}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-ink/40">
      {children}
    </span>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  required,
  inputRef,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  required?: boolean;
  inputRef?: React.RefObject<HTMLInputElement | null>;
}) {
  return (
    <label className="block">
      <Label>{label}</Label>
      <input
        ref={inputRef}
        type={type}
        value={value}
        required={required}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-[10px] bg-ink/[0.04] px-3 py-2 text-sm outline-none ring-1 ring-transparent placeholder:text-ink/35 focus:ring-brand/40"
      />
    </label>

  );
}
