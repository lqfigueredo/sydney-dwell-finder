import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { AppHeader } from "@/components/AppHeader";
import { BlueprintMap } from "@/components/BlueprintMap";
import { SUBURB_COORDS, SUBURB_NAMES, type Deal } from "@/lib/marketplace";

export const Route = createFileRoute("/_authenticated/post-listing")({
  head: () => ({
    meta: [
      { title: "List a property — Tidewater Sydney" },
      {
        name: "description",
        content:
          "Publish a Sydney rental or sale with photos, features and a pin on the Tidewater map.",
      },
      { property: "og:title", content: "List a property — Tidewater Sydney" },
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
  const [files, setFiles] = useState<File[]>([]);

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const uploadPhotos = async (listingId: string) => {
    const urls: string[] = [];
    for (const [i, file] of files.entries()) {
      const path = `${user!.id}/${listingId}/${Date.now()}-${i}-${file.name.replace(/[^\w.-]/g, "_")}`;
      const { error } = await supabase.storage.from("property-photos").upload(path, file);
      if (error) {
        toast.error(`Photo upload failed: ${error.message}`);
        continue;
      }
      const { data } = await supabase.storage
        .from("property-photos")
        .createSignedUrl(path, 60 * 60 * 24 * 365);
      if (data?.signedUrl) urls.push(data.signedUrl);
    }
    return urls;
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
          bedrooms: form.bedrooms,
          bathrooms: form.bathrooms,
          parking: form.parking,
          area_sqm: form.area ? Number(form.area) : null,
          description: form.description,
          features,
        })
        .select("id")
        .single();
      if (error) throw error;

      if (files.length) {
        const urls = await uploadPhotos(data.id);
        if (urls.length) {
          await supabase.from("listings").update({ cover_url: urls[0] ?? null }).eq("id", data.id);
          await supabase
            .from("listing_photos")
            .insert(urls.map((url, i) => ({ listing_id: data.id, url, sort_order: i })));
        }
      }

      toast.success("Your property is live.");
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
                  onChange={(v) => set("address", v)}
                  placeholder="12/48 Bourke Street"
                  required
                />
                <div className="grid grid-cols-2 gap-3">
                  <label className="block">
                    <Label>Suburb</Label>
                    <select
                      value={form.suburb}
                      onChange={(e) => {
                        set("suburb", e.target.value);
                        setPin(SUBURB_COORDS[e.target.value] ?? null);
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
              <Label>Pin the location</Label>
              <p className="mt-1 text-[12px] text-ink/45">
                Click the map to move the pin. Scroll to zoom, drag to pan.
              </p>
              <div className="mt-3 h-[380px]">
                <BlueprintMap
                  pins={
                    pin
                      ? [
                          {
                            id: "new",
                            lat: pin.lat,
                            lng: pin.lng,
                            label: form.suburb,
                            kind: "offered",
                          },
                        ]
                      : []
                  }
                  activeId="new"
                  onPick={setPin}
                />
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
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <Label>{label}</Label>
      <input
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
