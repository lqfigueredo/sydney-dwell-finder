import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AppHeader } from "@/components/AppHeader";
import { VerifiedSeal } from "@/components/VerifiedSeal";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import {
  getMyVerification,
  submitVerificationRequest,
  type MemberKind,
} from "@/lib/verification.functions";

export const Route = createFileRoute("/_authenticated/get-verified")({
  head: () => ({
    meta: [
      { title: "Get the verified seal — SydHub Sydney" },
      {
        name: "description",
        content:
          "Send your ID and ownership documents to the SydHub team, get the verified seal, and have your Sydney listings go live without photo review.",
      },
      { property: "og:title", content: "Get the verified seal — SydHub Sydney" },
      {
        property: "og:description",
        content: "Apply for SydHub verification so your listings publish without waiting on review.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: GetVerifiedPage,
});

const card = "rounded-[14px] border border-ink/10 bg-surface p-5";
const field =
  "w-full rounded-[10px] border border-ink/15 bg-surface px-3 py-2 text-sm outline-none focus:border-brand";

const KINDS: { value: MemberKind; label: string; hint: string }[] = [
  { value: "owner", label: "Property owner", hint: "Photo ID + proof of ownership (rates notice, title)" },
  { value: "agent", label: "Licensed agent", hint: "Photo ID + agency licence number or letterhead" },
  { value: "seeker", label: "Renter / buyer", hint: "Photo ID is enough" },
];

const ACCEPT = "image/jpeg,image/png,image/webp,application/pdf";
const MAX_BYTES = 10 * 1024 * 1024;

function StatusBanner({
  status,
  note,
}: {
  status: string;
  note: string | null;
}) {
  if (status === "approved")
    return (
      <div className="rounded-[12px] bg-brand/10 p-4 text-sm text-ink">
        <VerifiedSeal /> <span className="ml-2">Your posts go live without review.</span>
      </div>
    );
  const tone =
    status === "pending"
      ? "bg-accent/25 text-ink"
      : status === "needs_info"
        ? "bg-accent/25 text-ink"
        : "bg-red-700/10 text-red-700";
  const label =
    status === "pending"
      ? "Under review — we'll email you once a moderator has looked at your documents."
      : status === "needs_info"
        ? "A moderator needs more information."
        : status === "rejected"
          ? "Your request was declined."
          : status === "revoked"
            ? "Your verified seal was removed."
            : "";
  if (!label) return null;
  return (
    <div className={`rounded-[12px] p-4 text-sm ${tone}`}>
      <p className="font-medium">{label}</p>
      {note ? <p className="mt-1 opacity-80">Moderator note: {note}</p> : null}
    </div>
  );
}

function GetVerifiedPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const statusFn = useServerFn(getMyVerification);
  const submitFn = useServerFn(submitVerificationRequest);

  const [memberKind, setMemberKind] = useState<MemberKind>("owner");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);

  const state = useQuery({
    queryKey: ["my-verification", user?.id],
    enabled: !!user,
    queryFn: () => statusFn({}),
  });

  const submit = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Please sign in");
      if (!files.length) throw new Error("Attach at least one document");
      const docs: { path: string; label: string; mimeType?: string }[] = [];
      for (const file of files) {
        if (file.size > MAX_BYTES) throw new Error(`${file.name} is larger than 10 MB`);
        const ext = file.name.split(".").pop()?.toLowerCase() ?? "bin";
        const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
        const { error } = await supabase.storage
          .from("verification-docs")
          .upload(path, file, { contentType: file.type || undefined });
        if (error) throw new Error(error.message);
        docs.push({ path, label: file.name.slice(0, 80), mimeType: file.type });
      }
      return submitFn({ data: { memberKind, fullName, phone, note, docs } });
    },
    onMutate: () => setBusy(true),
    onSettled: () => setBusy(false),
    onSuccess: () => {
      toast.success("Request sent — a moderator will review your documents");
      setFiles([]);
      setNote("");
      void qc.invalidateQueries({ queryKey: ["my-verification"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const s = state.data;
  const canSubmit = s && s.status !== "pending" && s.status !== "approved";

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <AppHeader />
      <main className="mx-auto max-w-[900px] px-6 py-8">
        <h1 className="font-display text-2xl font-semibold tracking-tight">Get the verified seal</h1>
        <p className="mt-1 max-w-[62ch] text-sm text-ink/55">
          Verified members skip the moderation queue — listings, wanted ads and photos publish
          immediately. Send us proof of who you are and a moderator will review it.
        </p>

        <div className="mt-6 space-y-5">
          {state.isLoading ? (
            <p className="text-sm text-ink/50">Loading your status…</p>
          ) : (
            <StatusBanner status={s?.status ?? "none"} note={s?.note ?? null} />
          )}

          {s?.request ? (
            <div className={card}>
              <h2 className="font-display text-lg font-semibold">Your last request</h2>
              <dl className="mt-2 space-y-1 text-xs text-ink/60">
                <div>Submitted: {new Date(s.request.created_at).toLocaleString("en-AU")}</div>
                <div>Name given: {s.request.full_name}</div>
                <div>Member type: {s.request.member_kind}</div>
                <div>Status: {s.request.status.replace("_", " ")}</div>
              </dl>
              {s.docs.length ? (
                <ul className="mt-3 flex flex-wrap gap-2">
                  {s.docs.map((d) => (
                    <li key={d.id}>
                      <a
                        href={d.url}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-[8px] px-2.5 py-1 text-xs ring-1 ring-ink/15 hover:bg-ink/5"
                      >
                        {d.label}
                      </a>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}

          {canSubmit ? (
            <form
              className={card}
              onSubmit={(e) => {
                e.preventDefault();
                submit.mutate();
              }}
            >
              <h2 className="font-display text-lg font-semibold">
                {s?.status === "none" ? "Request verification" : "Send a new request"}
              </h2>

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <label className="text-sm">
                  <span className="text-xs font-medium text-ink/60">I am a…</span>
                  <select
                    value={memberKind}
                    onChange={(e) => setMemberKind(e.target.value as MemberKind)}
                    className={`mt-1 ${field}`}
                  >
                    {KINDS.map((k) => (
                      <option key={k.value} value={k.value}>
                        {k.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-sm">
                  <span className="text-xs font-medium text-ink/60">Full legal name</span>
                  <input
                    required
                    maxLength={120}
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className={`mt-1 ${field}`}
                    placeholder="As shown on your ID"
                  />
                </label>
                <label className="text-sm">
                  <span className="text-xs font-medium text-ink/60">Contact phone</span>
                  <input
                    maxLength={40}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className={`mt-1 ${field}`}
                    placeholder="04xx xxx xxx"
                  />
                </label>
                <label className="text-sm sm:col-span-2">
                  <span className="text-xs font-medium text-ink/60">Anything we should know</span>
                  <textarea
                    rows={3}
                    maxLength={1000}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    className={`mt-1 ${field}`}
                    placeholder="Optional — agency name, licence number, which property you own…"
                  />
                </label>
              </div>

              <div className="mt-4">
                <span className="text-xs font-medium text-ink/60">Documents (required)</span>
                <p className="mt-0.5 text-xs text-ink/45">
                  {KINDS.find((k) => k.value === memberKind)?.hint} · JPG, PNG, WEBP or PDF, max 10 MB
                  each. Only you and SydHub moderators can open these files.
                </p>
                <input
                  type="file"
                  multiple
                  accept={ACCEPT}
                  onChange={(e) => setFiles(Array.from(e.target.files ?? []).slice(0, 6))}
                  className="mt-2 block w-full text-sm text-ink/70 file:mr-3 file:rounded-[8px] file:border-0 file:bg-ink/5 file:px-3 file:py-1.5 file:text-sm"
                />
                {files.length ? (
                  <ul className="mt-2 space-y-1 text-xs text-ink/60">
                    {files.map((f) => (
                      <li key={f.name}>
                        {f.name} · {(f.size / 1024 / 1024).toFixed(1)} MB
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>

              <button
                type="submit"
                disabled={busy || !files.length}
                className="mt-5 rounded-[10px] bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground disabled:opacity-50"
              >
                {busy ? "Sending…" : "Submit for review"}
              </button>
            </form>
          ) : null}

          <Link to="/dashboard" className="inline-block text-sm text-ink/60 hover:underline">
            ← Back to my activity
          </Link>
        </div>
      </main>
    </div>
  );
}
