import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type SignedPhoto = { id: string; url: string };

const BUCKET = "property-photos";
const TTL = 60 * 60; // 1 hour

/** Legacy rows stored a long-lived signed URL; new rows store the storage path. */
const isAbsolute = (v: string) => /^https?:\/\//i.test(v);

async function signMany(paths: string[]): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  const needs = paths.filter((p) => p && !isAbsolute(p));
  for (const p of paths) if (p && isAbsolute(p)) out[p] = p;
  if (!needs.length) return out;

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.storage.from(BUCKET).createSignedUrls(needs, TTL);
  for (const row of data ?? []) {
    if (row.signedUrl && row.path) out[row.path] = row.signedUrl;
  }
  return out;
}

async function publicClient() {
  const { createClient } = await import("@supabase/supabase-js");
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  const url = process.env["SUPABASE_URL"]!;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input: RequestInfo | URL, init?: RequestInit) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`)
          h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

/**
 * Photos for a listing, visible to anyone — but only when the listing itself
 * passed moderation. Pending/rejected listings return nothing here.
 */
export const getPublicListingPhotos = createServerFn({ method: "POST" })
  .inputValidator((input: { listingId: string }) => input)
  .handler(async ({ data }): Promise<{ cover: string | null; photos: SignedPhoto[] }> => {
    const sb = await publicClient();
    // RLS only exposes approved listings from active accounts.
    const { data: listing } = await sb
      .from("listings")
      .select("id, cover_url")
      .eq("id", data.listingId)
      .maybeSingle();
    if (!listing) return { cover: null, photos: [] };

    const { data: rows } = await sb
      .from("listing_photos")
      .select("id, url")
      .eq("listing_id", data.listingId)
      .order("sort_order");

    const paths = [
      ...(listing.cover_url ? [listing.cover_url] : []),
      ...(rows ?? []).map((r) => r.url),
    ];
    const signed = await signMany(paths);
    return {
      cover: listing.cover_url ? (signed[listing.cover_url] ?? null) : null,
      photos: (rows ?? [])
        .map((r) => ({ id: r.id, url: signed[r.url] ?? "" }))
        .filter((p) => p.url),
    };
  });

/** Cover images for a set of publicly visible listings (browse cards). */
export const signPublicCovers = createServerFn({ method: "POST" })
  .inputValidator((input: { listingIds: string[] }) => input)
  .handler(async ({ data }): Promise<Record<string, string>> => {
    if (!data.listingIds.length) return {};
    const sb = await publicClient();
    const { data: rows } = await sb
      .from("listings")
      .select("id, cover_url")
      .in("id", data.listingIds.slice(0, 200));

    const visible = (rows ?? []).filter((r) => r.cover_url) as { id: string; cover_url: string }[];
    const signed = await signMany(visible.map((r) => r.cover_url));
    const out: Record<string, string> = {};
    for (const r of visible) {
      const u = signed[r.cover_url];
      if (u) out[r.id] = u;
    }
    return out;
  });

/**
 * Photos for a listing that is not public yet — owner or admin only.
 * Used by the owner dashboard and the moderation queue.
 */
export const getPrivateListingPhotos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { listingId: string }) => input)
  .handler(async ({ data, context }): Promise<{ cover: string | null; photos: SignedPhoto[] }> => {
    const { supabase, userId } = context;
    // RLS lets owners and admins read their own / all listings.
    const { data: listing } = await supabase
      .from("listings")
      .select("id, owner_id, cover_url")
      .eq("id", data.listingId)
      .maybeSingle();
    if (!listing) return { cover: null, photos: [] };

    if (listing.owner_id !== userId) {
      const { data: isAdmin } = await supabase.rpc("has_role", {
        _user_id: userId,
        _role: "admin",
      });
      if (!isAdmin) throw new Error("Forbidden");
    }

    const { data: rows } = await supabase
      .from("listing_photos")
      .select("id, url")
      .eq("listing_id", data.listingId)
      .order("sort_order");

    const paths = [
      ...(listing.cover_url ? [listing.cover_url] : []),
      ...(rows ?? []).map((r) => r.url),
    ];
    const signed = await signMany(paths);
    return {
      cover: listing.cover_url ? (signed[listing.cover_url] ?? null) : null,
      photos: (rows ?? [])
        .map((r) => ({ id: r.id, url: signed[r.url] ?? "" }))
        .filter((p) => p.url),
    };
  });
