import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type VerificationStatus =
  | "none"
  | "pending"
  | "needs_info"
  | "approved"
  | "rejected"
  | "revoked";
export type MemberKind = "owner" | "agent" | "seeker";

export type VerificationDoc = { id: string; label: string; url: string; mime_type: string | null };

const BUCKET = "verification-docs";
const TTL = 60 * 10; // 10 minutes — documents are sensitive

async function signDocs(
  rows: { id: string; label: string; path: string; mime_type: string | null }[],
): Promise<VerificationDoc[]> {
  if (!rows.length) return [];
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.storage
    .from(BUCKET)
    .createSignedUrls(rows.map((r) => r.path), TTL);
  const map = new Map((data ?? []).map((d) => [d.path, d.signedUrl]));
  return rows
    .map((r) => ({
      id: r.id,
      label: r.label,
      mime_type: r.mime_type,
      url: map.get(r.path) ?? "",
    }))
    .filter((d) => d.url);
}

type RpcClient = {
  rpc: (
    name: "has_role",
    args: { _user_id: string; _role: "admin" },
  ) => PromiseLike<{ data: boolean | null }>;
};

async function assertAdmin(supabase: RpcClient, userId: string) {
  const { data: isAdmin } = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: "admin",
  });
  if (!isAdmin) throw new Error("Forbidden");
}

/** The signed-in member's own verification state plus their latest request. */
export const getMyVerification = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const [profile, request] = await Promise.all([
      supabase
        .from("profiles")
        .select("verification_status, verification_note, verified_at, verified_until")
        .eq("id", userId)
        .maybeSingle(),
      supabase
        .from("verification_requests")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    let docs: VerificationDoc[] = [];
    if (request.data) {
      const { data: rows } = await supabase
        .from("verification_documents")
        .select("id, label, path, mime_type")
        .eq("request_id", request.data.id);
      docs = await signDocs(rows ?? []);
    }

    const expiresAt = profile.data?.verified_until ?? null;
    const expired = !!expiresAt && new Date(expiresAt).getTime() <= Date.now();

    return {
      status: (profile.data?.verification_status ?? "none") as VerificationStatus,
      note: profile.data?.verification_note ?? null,
      verifiedAt: profile.data?.verified_at ?? null,
      expiresAt,
      expired,
      request: request.data,
      docs,
    };
  });


/** Member submits (or re-submits) a verification request with uploaded documents. */
export const submitVerificationRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      memberKind: MemberKind;
      fullName: string;
      phone: string;
      note: string;
      docs: { path: string; label: string; mimeType?: string | undefined }[];
    }) => {
      const fullName = String(input.fullName ?? "").trim().slice(0, 120);
      if (fullName.length < 2) throw new Error("Please enter your full legal name");
      if (!Array.isArray(input.docs) || input.docs.length === 0)
        throw new Error("Attach at least one document");
      if (input.docs.length > 6) throw new Error("Attach at most 6 documents");
      return {
        memberKind: (["owner", "agent", "seeker"] as const).includes(input.memberKind)
          ? input.memberKind
          : ("owner" as MemberKind),
        fullName,
        phone: String(input.phone ?? "").trim().slice(0, 40),
        note: String(input.note ?? "").trim().slice(0, 1000),
        docs: input.docs.slice(0, 6).map((d) => ({
          path: String(d.path),
          label: String(d.label ?? "Document").slice(0, 80),
          mimeType: d.mimeType ? String(d.mimeType).slice(0, 100) : null,
        })),
      };
    },
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: profile } = await supabase
      .from("profiles")
      .select("verification_status, verified_until")
      .eq("id", userId)
      .maybeSingle();
    const sealExpired =
      !!profile?.verified_until && new Date(profile.verified_until).getTime() <= Date.now();
    if (profile?.verification_status === "pending")
      throw new Error("You already have a request under review");
    if (profile?.verification_status === "approved" && !sealExpired)
      throw new Error("You are already a verified member");


    for (const d of data.docs) {
      if (!d.path.startsWith(`${userId}/`)) throw new Error("Invalid document path");
    }

    const { data: request, error } = await supabase
      .from("verification_requests")
      .insert({
        user_id: userId,
        member_kind: data.memberKind,
        full_name: data.fullName,
        phone: data.phone,
        note: data.note,
        status: "pending",
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    const { error: docErr } = await supabase.from("verification_documents").insert(
      data.docs.map((d) => ({
        request_id: request.id,
        user_id: userId,
        path: d.path,
        label: d.label,
        mime_type: d.mimeType,
      })),
    );
    if (docErr) throw new Error(docErr.message);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("profiles")
      .update({ verification_status: "pending", verification_note: null })
      .eq("id", userId);

    return { ok: true, id: request.id };
  });

/** Admin queue: every verification request with member context and signed documents. */
export const getVerificationQueue = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);

    const { data: requests, error } = await supabase
      .from("verification_requests")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);

    const ids = (requests ?? []).map((r) => r.id);
    const userIds = [...new Set((requests ?? []).map((r) => r.user_id))];

    const [docRows, profiles] = await Promise.all([
      ids.length
        ? supabase
            .from("verification_documents")
            .select("id, request_id, label, path, mime_type")
            .in("request_id", ids)
        : Promise.resolve({ data: [] as never[] }),
      userIds.length
        ? supabase
            .from("profiles")
            .select(
              "id, display_name, suburb, verification_status, verified_at, verified_until, created_at",
            )
            .in("id", userIds)
        : Promise.resolve({ data: [] as never[] }),
    ]);

    const signed = await signDocs(
      (docRows.data ?? []).map((d: any) => ({
        id: d.id,
        label: d.label,
        path: d.path,
        mime_type: d.mime_type,
      })),
    );
    const byId = new Map(signed.map((s) => [s.id, s]));

    const docsByRequest: Record<string, VerificationDoc[]> = {};
    for (const d of (docRows.data ?? []) as any[]) {
      const s = byId.get(d.id);
      if (!s) continue;
      (docsByRequest[d.request_id] ??= []).push(s);
    }

    return {
      requests: requests ?? [],
      profiles: (profiles.data ?? []) as {
        id: string;
        display_name: string;
        suburb: string | null;
        verification_status: VerificationStatus;
        verified_at: string | null;
        verified_until: string | null;
        created_at: string;
      }[],
      docsByRequest,
    };
  });

/**
 * Admin decision on a member's verified seal.
 * Granting sets verified_at (which drives auto-approval of their posts);
 * rejecting, asking for more info, or revoking always records a reason.
 */
export const decideVerification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      userId: string;
      requestId?: string | undefined;
      decision: "approved" | "rejected" | "needs_info" | "revoked";
      reason?: string | undefined;
    }) => {
      const reason = String(input.reason ?? "").trim().slice(0, 600);
      if (input.decision !== "approved" && reason.length < 3)
        throw new Error("Please give the member a reason");
      return {
        userId: String(input.userId),
        requestId: input.requestId ? String(input.requestId) : undefined,
        decision: input.decision,
        reason,
      };
    },
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId: adminId } = context;
    await assertAdmin(supabase, adminId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const now = new Date().toISOString();

    if (data.requestId) {
      const { error } = await supabaseAdmin
        .from("verification_requests")
        .update({
          status: data.decision,
          decision_reason: data.reason || null,
          reviewed_by: adminId,
          reviewed_at: now,
        })
        .eq("id", data.requestId);
      if (error) throw new Error(error.message);
    }

    const approved = data.decision === "approved";
    const { error: pErr } = await supabaseAdmin
      .from("profiles")
      .update({
        verification_status: data.decision,
        verification_note: data.reason || null,
        verified_at: approved ? now : null,
        verified_by: approved ? adminId : null,
      })
      .eq("id", data.userId);
    if (pErr) throw new Error(pErr.message);

    await supabaseAdmin.from("admin_error_logs").insert({
      message: `Verification ${data.decision} for member ${data.userId}`,
      detail: data.reason || null,
      route: "/admin/verification",
      source: "server",
      severity: "info",
    });

    return { ok: true };
  });
