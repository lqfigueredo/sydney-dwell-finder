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
          "id, title, suburb, deal, property_type, price_cents, bedrooms, published, moderation_status, rejection_reason, lat, lng, cover_url, owner_id, created_at",
        )
        .order("created_at", { ascending: false })
        .limit(500),
      supabase
        .from("wanted_ads")
        .select(
          "id, title, suburbs, deal, budget_cents, bedrooms_min, open, moderation_status, rejection_reason, seeker_id, created_at",
        )
        .order("created_at", { ascending: false })
        .limit(500),
      supabase
        .from("profiles")
        .select(
          "id, display_name, suburb, bio, phone, avatar_url, deactivated_at, verified_at, verified_until, terms_accepted_at, terms_version, created_at",
        )
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
  | { kind: "listing.moderate"; id: string; status: ModerationStatus; reason?: string | undefined }
  | { kind: "wanted.open"; id: string; value: boolean }
  | { kind: "wanted.delete"; id: string }
  | { kind: "wanted.moderate"; id: string; status: ModerationStatus; reason?: string | undefined }
  | { kind: "comment.delete"; id: string }
  | { kind: "role.set"; id: string; value: boolean }
  | { kind: "user.deactivate"; id: string; value: boolean }
  | { kind: "user.verify"; id: string; value: boolean }
  | { kind: "photo.remove"; id: string; listingId: string; reason?: string | undefined }
  | { kind: "errors.clear" };

export type ModerationStatus = "pending" | "approved" | "rejected" | "paused";

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

    const fail = (error: { message: string } | null) => {
      if (error) throw new Error(error.message);
    };

    if (data.kind === "listing.publish") {
      fail(
        (await supabase.from("listings").update({ published: data.value }).eq("id", data.id)).error,
      );
    } else if (data.kind === "listing.delete") {
      fail((await supabase.from("listings").delete().eq("id", data.id)).error);
    } else if (data.kind === "listing.moderate") {
      fail(
        (
          await supabase
            .from("listings")
            .update({
              moderation_status: data.status,
              rejection_reason: data.status === "rejected" ? (data.reason ?? null) : null,
            })
            .eq("id", data.id)
        ).error,
      );
    } else if (data.kind === "wanted.open") {
      fail((await supabase.from("wanted_ads").update({ open: data.value }).eq("id", data.id)).error);
    } else if (data.kind === "wanted.delete") {
      fail((await supabase.from("wanted_ads").delete().eq("id", data.id)).error);
    } else if (data.kind === "wanted.moderate") {
      fail(
        (
          await supabase
            .from("wanted_ads")
            .update({
              moderation_status: data.status,
              rejection_reason: data.status === "rejected" ? (data.reason ?? null) : null,
            })
            .eq("id", data.id)
        ).error,
      );
    } else if (data.kind === "comment.delete") {
      fail((await supabase.from("comments").delete().eq("id", data.id)).error);
    } else if (data.kind === "role.set") {
      if (data.id === userId && !data.value)
        throw new Error("You cannot remove your own admin access");
      if (data.value) {
        const { error } = await supabase
          .from("user_roles")
          .insert({ user_id: data.id, role: "admin" });
        if (error && !error.message.includes("duplicate")) throw new Error(error.message);
      } else {
        fail(
          (
            await supabase
              .from("user_roles")
              .delete()
              .eq("user_id", data.id)
              .eq("role", "admin")
          ).error,
        );
      }
    } else if (data.kind === "user.deactivate") {
      if (data.id === userId && data.value)
        throw new Error("You cannot deactivate your own account");
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      fail(
        (
          await supabaseAdmin
            .from("profiles")
            .update({ deactivated_at: data.value ? new Date().toISOString() : null })
            .eq("id", data.id)
        ).error,
      );
    } else if (data.kind === "user.verify") {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      fail(
        (
          await supabaseAdmin
            .from("profiles")
            .update({
              verified_at: data.value ? new Date().toISOString() : null,
              verified_by: data.value ? userId : null,
            })
            .eq("id", data.id)
        ).error,
      );
    } else if (data.kind === "photo.remove") {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: photo } = await supabaseAdmin
        .from("listing_photos")
        .select("id, url, listing_id")
        .eq("id", data.id)
        .maybeSingle();
      if (!photo) throw new Error("Photo not found");

      if (photo.url && !/^https?:\/\//i.test(photo.url)) {
        await supabaseAdmin.storage.from("property-photos").remove([photo.url]);
      }
      fail((await supabaseAdmin.from("listing_photos").delete().eq("id", data.id)).error);

      const { data: listing } = await supabaseAdmin
        .from("listings")
        .select("id, cover_url")
        .eq("id", photo.listing_id)
        .maybeSingle();

      const note = `A moderator removed a photo${data.reason ? `: ${data.reason}` : "."}`;
      const patch: { photo_removed_note: string; cover_url?: string | null } = {
        photo_removed_note: note,
      };
      if (listing?.cover_url === photo.url) {
        const { data: next } = await supabaseAdmin
          .from("listing_photos")
          .select("url")
          .eq("listing_id", photo.listing_id)
          .order("sort_order")
          .limit(1);
        patch.cover_url = next?.[0]?.url ?? null;
      }
      fail((await supabaseAdmin.from("listings").update(patch).eq("id", photo.listing_id)).error);
    } else if (data.kind === "errors.clear") {
      fail(
        (await supabase.from("admin_error_logs").delete().gte("created_at", "1970-01-01")).error,
      );
    }

    return { ok: true };
  });

/** Per-member detail for the admin user management page. */
export const getAdminUserDetail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");

    const [profile, listings, wanted, applications, comments, roles] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", data.id).maybeSingle(),
      supabase
        .from("listings")
        .select("id, title, suburb, moderation_status, published, created_at")
        .eq("owner_id", data.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("wanted_ads")
        .select("id, title, suburbs, moderation_status, open, created_at")
        .eq("seeker_id", data.id)
        .order("created_at", { ascending: false }),
      supabase.from("applications").select("id, status").eq("applicant_id", data.id),
      supabase.from("comments").select("id").eq("author_id", data.id),
      supabase.from("user_roles").select("role").eq("user_id", data.id),
    ]);

    if (profile.error) throw new Error(profile.error.message);

    return {
      profile: profile.data,
      listings: listings.data ?? [],
      wanted: wanted.data ?? [],
      applications: applications.data ?? [],
      commentCount: (comments.data ?? []).length,
      roles: (roles.data ?? []).map((r) => r.role),
    };
  });

export type HealthCheck = {
  key: string;
  label: string;
  status: "ok" | "degraded" | "failed";
  detail: string;
  ms: number;
};

/** Live integration checks for the admin health page. */
export const getSystemHealth = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");

    const timed = async (
      key: string,
      label: string,
      run: () => Promise<{ status: HealthCheck["status"]; detail: string }>,
    ): Promise<HealthCheck> => {
      const start = Date.now();
      try {
        const result = await run();
        return { key, label, ...result, ms: Date.now() - start };
      } catch (error) {
        return {
          key,
          label,
          status: "failed",
          detail: error instanceof Error ? error.message : "Unknown error",
          ms: Date.now() - start,
        };
      }
    };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const checks = await Promise.all([
      timed("database", "Database", async () => {
        const { error, count } = await supabase
          .from("listings")
          .select("id", { count: "exact", head: true });
        if (error) return { status: "failed" as const, detail: error.message };
        return { status: "ok" as const, detail: `Reachable · ${count ?? 0} listing rows` };
      }),
      timed("auth", "Accounts & auth", async () => {
        const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1 });
        if (error) return { status: "failed" as const, detail: error.message };
        return {
          status: "ok" as const,
          detail: `Auth service responding · ${data.users.length ? "users present" : "no users yet"}`,
        };
      }),
      timed("storage", "Photo storage", async () => {
        const { error } = await supabaseAdmin.storage.from("property-photos").list("", { limit: 1 });
        if (error) return { status: "failed" as const, detail: error.message };
        return { status: "ok" as const, detail: "Bucket property-photos reachable" };
      }),
      timed("maps", "Google Maps", async () => {
        const key = process.env["GOOGLE_MAPS_API_KEY"];
        if (!key) return { status: "degraded" as const, detail: "No Maps key configured" };
        const res = await fetch(
          `https://maps.googleapis.com/maps/api/geocode/json?address=Sydney+NSW&key=${key}`,
        );
        const body = (await res.json()) as { status?: string; error_message?: string };
        if (body.status === "OK") return { status: "ok" as const, detail: "Geocoding API responding" };
        return {
          status: "degraded" as const,
          detail: body.error_message ?? `Maps API returned ${body.status ?? res.status}`,
        };
      }),
    ]);

    const { data: errors } = await supabase
      .from("admin_error_logs")
      .select("id, message, detail, route, source, severity, created_at")
      .order("created_at", { ascending: false })
      .limit(50);

    return { checks, errors: errors ?? [], checkedAt: new Date().toISOString() };
  });

/** Records a runtime error so admins can see it on the health page. */
export const logAppError = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { message: string; detail?: string; route?: string; source?: string }) => ({
    message: String(input.message ?? "Unknown error").slice(0, 500),
    detail: input.detail ? String(input.detail).slice(0, 4000) : undefined,
    route: input.route ? String(input.route).slice(0, 300) : undefined,
    source: input.source === "server" ? "server" : "client",
  }))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("admin_error_logs").insert({
      message: data.message,
      detail: data.detail ?? null,
      route: data.route ?? null,
      source: data.source,
    });
    return { ok: true };
  });
