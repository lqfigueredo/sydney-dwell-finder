import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const AVATAR_BUCKET = "avatars";
const DOC_BUCKET = "verification-docs";
const TTL = 60 * 30;

export type ProfileDoc = { id: string; label: string; created_at: string };

export type MyProfile = {
  displayName: string;
  phone: string;
  suburb: string;
  bio: string;
  isBusiness: boolean;
  companyName: string;
  abn: string;
  avatarPath: string | null;
  avatarUrl: string | null;
  documents: ProfileDoc[];
  complete: boolean;
  missing: string[];
};

function missingParts(p: {
  display_name: string | null;
  avatar_url: string | null;
  phone: string | null;
  is_business: boolean | null;
  company_name: string | null;
  abn: string | null;
  docCount: number;
}): string[] {
  const missing: string[] = [];
  if (!p.display_name?.trim()) missing.push("Your name");
  if (!p.avatar_url?.trim()) missing.push("Profile photo");
  if (!p.phone?.trim()) missing.push("Phone number");
  if (p.docCount === 0) missing.push("ID document");
  if (p.is_business) {
    if (!p.company_name?.trim()) missing.push("Company name");
    if (!p.abn?.trim()) missing.push("ABN");
  }
  return missing;
}

async function signAvatar(path: string | null): Promise<string | null> {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.storage.from(AVATAR_BUCKET).createSignedUrl(path, TTL);
  return data?.signedUrl ?? null;
}

/** The signed-in member's profile plus what is still missing before they can publish. */
export const getMyProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MyProfile> => {
    const { supabase, userId } = context;

    const [profileRes, docsRes] = await Promise.all([
      supabase
        .from("profiles")
        .select("display_name, avatar_url, phone, suburb, bio, is_business, company_name, abn")
        .eq("id", userId)
        .maybeSingle(),
      supabase
        .from("profile_documents")
        .select("id, label, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false }),
    ]);

    const p = profileRes.data;
    const documents = (docsRes.data ?? []) as ProfileDoc[];
    const missing = missingParts({
      display_name: p?.display_name ?? null,
      avatar_url: p?.avatar_url ?? null,
      phone: p?.phone ?? null,
      is_business: p?.is_business ?? false,
      company_name: p?.company_name ?? null,
      abn: p?.abn ?? null,
      docCount: documents.length,
    });

    return {
      displayName: p?.display_name ?? "",
      phone: p?.phone ?? "",
      suburb: p?.suburb ?? "",
      bio: p?.bio ?? "",
      isBusiness: p?.is_business ?? false,
      companyName: p?.company_name ?? "",
      abn: p?.abn ?? "",
      avatarPath: p?.avatar_url ?? null,
      avatarUrl: await signAvatar(p?.avatar_url ?? null),
      documents,
      complete: missing.length === 0,
      missing,
    };
  });

type SaveInput = {
  displayName: string;
  phone: string;
  suburb?: string | undefined;
  bio?: string | undefined;
  isBusiness: boolean;
  companyName?: string | undefined;
  abn?: string | undefined;
  /** Storage path in the private avatars bucket, when a new photo was uploaded. */
  avatarPath?: string | null | undefined;
  /** Newly uploaded ID document in the private documents bucket. */
  document?: { path: string; label: string; mimeType?: string | undefined } | null | undefined;
};

/** Save the member's own profile details, photo and ID document. */
export const saveMyProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: SaveInput) => {
    const displayName = String(input.displayName ?? "").trim().slice(0, 120);
    if (displayName.length < 2) throw new Error("Please enter your full name");
    const phone = String(input.phone ?? "").trim().slice(0, 40);
    const isBusiness = !!input.isBusiness;
    const companyName = String(input.companyName ?? "").trim().slice(0, 160);
    const abn = String(input.abn ?? "").trim().slice(0, 20);
    if (isBusiness && companyName.length < 2)
      throw new Error("Please enter your company or agency name");
    if (isBusiness && abn.replace(/\s/g, "").length !== 11)
      throw new Error("An ABN is 11 digits");
    return {
      displayName,
      phone,
      suburb: String(input.suburb ?? "").trim().slice(0, 80),
      bio: String(input.bio ?? "").trim().slice(0, 600),
      isBusiness,
      companyName,
      abn,
      avatarPath: input.avatarPath ? String(input.avatarPath) : null,
      document: input.document
        ? {
            path: String(input.document.path),
            label: String(input.document.label ?? "ID document").slice(0, 80),
            mimeType: input.document.mimeType ? String(input.document.mimeType).slice(0, 100) : null,
          }
        : null,
    };
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    if (data.avatarPath && !data.avatarPath.startsWith(`${userId}/`))
      throw new Error("Invalid photo path");
    if (data.document && !data.document.path.startsWith(`${userId}/`))
      throw new Error("Invalid document path");

    const update: Record<string, unknown> = {
      display_name: data.displayName,
      phone: data.phone,
      suburb: data.suburb || null,
      bio: data.bio || null,
      is_business: data.isBusiness,
      company_name: data.isBusiness ? data.companyName : null,
      abn: data.isBusiness ? data.abn : null,
    };
    if (data.avatarPath) update["avatar_url"] = data.avatarPath;

    const { error } = await supabase.from("profiles").update(update).eq("id", userId);
    if (error) throw new Error(error.message);

    if (data.document) {
      const { error: docErr } = await supabase.from("profile_documents").insert({
        user_id: userId,
        path: data.document.path,
        label: data.document.label,
        mime_type: data.document.mimeType,
      });
      if (docErr) throw new Error(docErr.message);
    }

    return { ok: true };
  });

export const AVATAR_BUCKET_NAME = AVATAR_BUCKET;
export const DOC_BUCKET_NAME = DOC_BUCKET;
