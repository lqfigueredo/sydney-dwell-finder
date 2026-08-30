import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { AppHeader } from "@/components/AppHeader";
import {
  PROPERTY_KINDS,
  SUBURB_COORDS,
  SUBURB_NAMES,
  type Deal,
  type PropertyKind,
} from "@/lib/marketplace";

export const Route = createFileRoute("/_authenticated/post-wanted")({
  head: () => ({
    meta: [
      { title: "Post what you're looking for — SydHub Sydney" },
      {
        name: "description",
        content:
          "Publish a wanted ad with your budget, suburbs and must-haves, and let Sydney owners apply to you.",
      },
      { property: "og:title", content: "Post what you're looking for — SydHub Sydney" },
      {
        property: "og:description",
        content: "Publish your brief and let Sydney owners apply to you.",
      },
    ],
  }),
  component: PostWanted,
});

const MUST_HAVES = [
  "Pets allowed",
  "Parking",
  "Balcony",
  "Air conditioning",
  "Near train",
  "Furnished",
  "Home office",
  "Ground floor",
];

function PostWanted() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState("");
  const [deal, setDeal] = useState<Deal>("rent");
  const [suburbs, setSuburbs] = useState<string[]>([]);
  const [budget, setBudget] = useState("");
  const [bedsMin, setBedsMin] = useState(1);
  const [moveIn, setMoveIn] = useState("");
  const [mustHaves, setMustHaves] = useState<string[]>([]);
  const [propertyTypes, setPropertyTypes] = useState<PropertyKind[]>([]);
  const [notes, setNotes] = useState("");

  const toggle = (list: string[], set: (v: string[]) => void, value: string) =>
    set(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setBusy(true);
    try {
      const coords = suburbs[0] ? SUBURB_COORDS[suburbs[0]] : undefined;
      const { data, error } = await supabase
        .from("wanted_ads")
        .insert({
          seeker_id: user.id,
          deal,
          title,
          suburbs,
          budget_cents: Math.round(Number(budget || 0) * 100),
          bedrooms_min: bedsMin,
          must_haves: mustHaves,
          property_types: propertyTypes,
          move_in_date: moveIn || null,
          notes,
          lat: coords?.lat ?? null,
          lng: coords?.lng ?? null,
        })
        .select("id, moderation_status")
        .single();
      if (error) throw error;
      toast.success(
        data.moderation_status === "approved"
          ? "Published — your verified seal skipped the review queue."
          : "Submitted — a moderator will review it shortly.",
      );
      void navigate({ to: "/wanted/$id", params: { id: data.id } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not publish");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <AppHeader mode="wanted" />
      <main className="mx-auto max-w-[820px] px-6 py-8">
        <h1 className="font-display text-3xl font-semibold">Post what you're looking for</h1>
        <p className="mt-1 text-sm text-ink/55">
          Owners and agents can apply to you with a matching property.
        </p>

        <form onSubmit={submit} className="mt-6 space-y-4">
          <div className="rounded-xl bg-canvas p-5 ring-1 ring-ink/10">
            <div className="flex rounded-[10px] bg-ink/[0.04] p-1">
              {(["rent", "buy"] as Deal[]).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDeal(d)}
                  className={`flex-1 rounded-[8px] px-3 py-1.5 text-sm font-medium ${
                    deal === d ? "bg-canvas ring-1 ring-ink/10" : "text-ink/50"
                  }`}
                >
                  {d === "rent" ? "Looking to rent" : "Looking to buy"}
                </button>
              ))}
            </div>

            <div className="mt-4 space-y-3">
              <label className="block">
                <Label>Headline</Label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  placeholder="Couple + cat seeking 2 bed in the Inner West"
                  className="mt-1 w-full rounded-[10px] bg-ink/[0.04] px-3 py-2 text-sm outline-none ring-1 ring-transparent placeholder:text-ink/35 focus:ring-brand/40"
                />
              </label>

              <div>
                <Label>Suburbs you'd consider</Label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {SUBURB_NAMES.map((s) => {
                    const on = suburbs.includes(s);
                    return (
                      <button
                        key={s}
                        type="button"
                        onClick={() => toggle(suburbs, setSuburbs, s)}
                        className={`rounded-full px-3 py-1.5 text-[12px] font-medium ring-1 ${
                          on
                            ? "bg-brand/10 text-brand ring-brand/30"
                            : "bg-ink/[0.03] text-ink/60 ring-ink/10"
                        }`}
                      >
                        {s}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <Label>Property types you'd consider</Label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {PROPERTY_KINDS.map((k) => {
                    const on = propertyTypes.includes(k.value);
                    return (
                      <button
                        key={k.value}
                        type="button"
                        aria-pressed={on}
                        onClick={() =>
                          setPropertyTypes((prev) =>
                            on ? prev.filter((x) => x !== k.value) : [...prev, k.value],
                          )
                        }
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

              <div className="grid grid-cols-3 gap-3">
                <label className="block">
                  <Label>{deal === "rent" ? "Budget /week" : "Budget"}</Label>
                  <input
                    type="number"
                    value={budget}
                    onChange={(e) => setBudget(e.target.value)}
                    required
                    placeholder={deal === "rent" ? "850" : "1400000"}
                    className="mt-1 w-full rounded-[10px] bg-ink/[0.04] px-3 py-2 text-sm outline-none ring-1 ring-transparent focus:ring-brand/40"
                  />
                </label>
                <label className="block">
                  <Label>Min bedrooms</Label>
                  <input
                    type="number"
                    value={bedsMin}
                    onChange={(e) => setBedsMin(Number(e.target.value))}
                    className="mt-1 w-full rounded-[10px] bg-ink/[0.04] px-3 py-2 text-sm outline-none ring-1 ring-transparent focus:ring-brand/40"
                  />
                </label>
                <label className="block">
                  <Label>Move in from</Label>
                  <input
                    type="date"
                    value={moveIn}
                    onChange={(e) => setMoveIn(e.target.value)}
                    className="mt-1 w-full rounded-[10px] bg-ink/[0.04] px-3 py-2 text-sm outline-none ring-1 ring-transparent focus:ring-brand/40"
                  />
                </label>
              </div>

              <div>
                <Label>Must-haves</Label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {MUST_HAVES.map((m) => {
                    const on = mustHaves.includes(m);
                    return (
                      <button
                        key={m}
                        type="button"
                        onClick={() => toggle(mustHaves, setMustHaves, m)}
                        className={`rounded-full px-3 py-1.5 text-[12px] font-medium ring-1 ${
                          on
                            ? "bg-accent/25 text-ink ring-accent/40"
                            : "bg-ink/[0.03] text-ink/60 ring-ink/10"
                        }`}
                      >
                        {m}
                      </button>
                    );
                  })}
                </div>
              </div>

              <label className="block">
                <Label>Anything else</Label>
                <textarea
                  rows={4}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Who's moving, lease length, references…"
                  className="mt-1 w-full rounded-[10px] bg-ink/[0.04] px-3 py-2 text-sm outline-none ring-1 ring-transparent placeholder:text-ink/35 focus:ring-brand/40"
                />
              </label>
            </div>
          </div>

          <button
            disabled={busy}
            className="w-full rounded-[10px] bg-brand px-4 py-3 text-sm font-semibold text-brand-foreground hover:bg-brand/90 disabled:opacity-60"
          >
            {busy ? "Publishing…" : "Publish wanted ad"}
          </button>
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
