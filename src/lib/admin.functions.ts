import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getAdminSnapshot = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");

    const [listings, wanted, profiles, applications, comments, photos, roles] = await Promise.all([
      supabase
        .from("listings")
        .select(
          "id, title, suburb, deal, property_type, price_cents, bedrooms, published, lat, lng, cover_url, owner_id, created_at",
        )
        .order("created_at", { ascending: false })
        .limit(500),
      supabase
        .from("wanted_ads")
        .select(
          "id, title, suburbs, deal, budget_cents, bedrooms_min, open, seeker_id, created_at",
        )
        .order("created_at", { ascending: false })
        .limit(500),
      supabase
        .from("profiles")
        .select("id, display_name, suburb, created_at")
        .order("created_at", { ascending: false })
        .limit(500),
      supabase
        .from("applications")
        .select("id, status, message, created_at, applicant_id, wanted_ad_id, listing_id")
        .order("created_at", { ascending: false })
        .limit(500),
      supabase
        .from("comments")
        .select("id, body, author_id, listing_id, wanted_ad_id, created_at")
        .order("created_at", { ascending: false })
        .limit(500),
      supabase.from("listing_photos").select("id, listing_id"),
      supabase.from("user_roles").select("user_id, role"),
    ]);

    const err =
      listings.error ??
      wanted.error ??
      profiles.error ??
      applications.error ??
      comments.error ??
      photos.error ??
      roles.error;
    if (err) throw new Error(err.message);

    return {
      listings: listings.data ?? [],
      wanted: wanted.data ?? [],
      profiles: profiles.data ?? [],
      applications: applications.data ?? [],
      comments: comments.data ?? [],
      photos: photos.data ?? [],
      roles: roles.data ?? [],
    };
  });

type Action =
  | { kind: "listing.publish"; id: string; value: boolean }
  | { kind: "listing.delete"; id: string }
  | { kind: "wanted.open"; id: string; value: boolean }
  | { kind: "wanted.delete"; id: string }
  | { kind: "comment.delete"; id: string }
  | { kind: "role.set"; id: string; value: boolean };

export const runAdminAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: Action) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");

    if (data.kind === "listing.publish") {
      const { error } = await supabase
        .from("listings")
        .update({ published: data.value })
        .eq("id", data.id);
      if (error) throw new Error(error.message);
    } else if (data.kind === "listing.delete") {
      const { error } = await supabase.from("listings").delete().eq("id", data.id);
      if (error) throw new Error(error.message);
    } else if (data.kind === "wanted.open") {
      const { error } = await supabase
        .from("wanted_ads")
        .update({ open: data.value })
        .eq("id", data.id);
      if (error) throw new Error(error.message);
    } else if (data.kind === "wanted.delete") {
      const { error } = await supabase.from("wanted_ads").delete().eq("id", data.id);
      if (error) throw new Error(error.message);
    } else if (data.kind === "comment.delete") {
      const { error } = await supabase.from("comments").delete().eq("id", data.id);
      if (error) throw new Error(error.message);
    } else if (data.kind === "role.set") {
      if (data.id === userId && !data.value) throw new Error("You cannot remove your own admin access");
      if (data.value) {
        const { error } = await supabase
          .from("user_roles")
          .insert({ user_id: data.id, role: "admin" });
        if (error && !error.message.includes("duplicate")) throw new Error(error.message);
      } else {
        const { error } = await supabase
          .from("user_roles")
          .delete()
          .eq("user_id", data.id)
          .eq("role", "admin");
        if (error) throw new Error(error.message);
      }
    }

    return { ok: true };
  });
