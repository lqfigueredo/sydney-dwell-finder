import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AppHeader } from "@/components/AppHeader";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { getMyProfile, saveMyProfile } from "@/lib/profile.functions";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [
      { title: "My profile — SydHub Sydney" },
      {
        name: "description",
        content:
          "Add your photo, contact details, ID document and company details so you can publish listings and wanted ads on SydHub.",
      },
      { property: "og:title", content: "My profile — SydHub Sydney" },
      {
        property: "og:description",
        content: "Complete your SydHub profile before publishing a Sydney property or wanted ad.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProfilePage,
});

const card = "rounded-[14px] border border-ink/10 bg-surface p-5";
const field =
  "mt-1 w-full rounded-[10px] border border-ink/15 bg-surface px-3 py-2 text-sm outline-none focus:border-brand";
const labelCls = "text-[12px] font-medium uppercase tracking-[0.12em] text-ink/45";

const IMAGE_TYPES = "image/jpeg,image/png,image/webp";
const DOC_TYPES = "image/jpeg,image/png,image/webp,application/pdf";
const MAX_BYTES = 10 * 1024 * 1024;

function ProfilePage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const loadFn = useServerFn(getMyProfile);
  const saveFn = useServerFn(saveMyProfile);

  const profile = useQuery({
    queryKey: ["my-profile", user?.id],
    enabled: !!user,
    queryFn: () => loadFn({}),
  });

  const [form, setForm] = useState({
    displayName: "",
    phone: "",
    suburb: "",
    bio: "",
    isBusiness: false,
    companyName: "",
    abn: "",
  });
  const [photo, setPhoto] = useState<File | null>(null);
  const [doc, setDoc] = useState<File | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const p = profile.data;
    if (!p || hydrated) return;
    setForm({
      displayName: p.displayName,
      phone: p.phone,
      suburb: p.suburb,
      bio: p.bio,
      isBusiness: p.isBusiness,
      companyName: p.companyName,
      abn: p.abn,
    });
    setHydrated(true);
  }, [profile.data, hydrated]);

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const save = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Please sign in");

      let avatarPath: string | null = null;
      if (photo) {
        if (photo.size > 5 * 1024 * 1024) throw new Error("Your photo must be under 5 MB");
        const ext = photo.name.split(".").pop()?.toLowerCase() ?? "jpg";
        const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
        const { error } = await supabase.storage
          .from("avatars")
          .upload(path, photo, { contentType: photo.type || "image/jpeg" });
        if (error) throw new Error(error.message);
        avatarPath = path;
      }

      let document: { path: string; label: string; mimeType: string } | null = null;
      if (doc) {
        if (doc.size > MAX_BYTES) throw new Error("Your document must be under 10 MB");
        const ext = doc.name.split(".").pop()?.toLowerCase() ?? "bin";
        const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
        const { error } = await supabase.storage
          .from("verification-docs")
          .upload(path, doc, { contentType: doc.type || "application/octet-stream" });
        if (error) throw new Error(error.message);
        document = {
          path,
          label: doc.name.slice(0, 80),
          mimeType: doc.type || "application/octet-stream",
        };
      }

      return saveFn({ data: { ...form, avatarPath, document } });
    },
    onSuccess: () => {
      toast.success("Profile saved");
      setPhoto(null);
      setDoc(null);
      void qc.invalidateQueries({ queryKey: ["my-profile"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const p = profile.data;

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <AppHeader />
      <main className="mx-auto max-w-[820px] px-6 py-8">
        <h1 className="font-display text-2xl font-semibold tracking-tight">My profile</h1>
        <p className="mt-1 max-w-[62ch] text-sm text-ink/55">
          SydHub only publishes listings and wanted ads from members we can identify. Add your
          photo, phone number and an ID document — and your company details if you post on behalf of
          an agency.
        </p>

        {p && !p.complete && (
          <div className="mt-5 rounded-[12px] bg-accent/25 p-4 text-sm">
            <p className="font-medium">Still needed before you can publish:</p>
            <ul className="mt-1 list-disc pl-5 text-ink/70">
              {p.missing.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          </div>
        )}
        {p?.complete && (
          <div className="mt-5 rounded-[12px] bg-brand/10 p-4 text-sm">
            Your profile is complete — you can publish listings and wanted ads.
          </div>
        )}

        <form
          className="mt-6 space-y-5"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          <section className={card}>
            <h2 className="font-display text-lg font-semibold">Photo</h2>
            <div className="mt-3 flex items-center gap-4">
              <div className="size-16 overflow-hidden rounded-full bg-ink/[0.06] ring-1 ring-ink/10">
                {photo ? (
                  <img
                    src={URL.createObjectURL(photo)}
                    alt=""
                    className="size-full object-cover"
                  />
                ) : p?.avatarUrl ? (
                  <img src={p.avatarUrl} alt="" className="size-full object-cover" />
                ) : null}
              </div>
              <input
                type="file"
                accept={IMAGE_TYPES}
                onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
                className="text-sm"
              />
            </div>
          </section>

          <section className={`${card} space-y-3`}>
            <h2 className="font-display text-lg font-semibold">Contact details</h2>
            <label className="block">
              <span className={labelCls}>Full name</span>
              <input
                className={field}
                value={form.displayName}
                onChange={(e) => set("displayName", e.target.value)}
                required
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className={labelCls}>Phone</span>
                <input
                  className={field}
                  value={form.phone}
                  onChange={(e) => set("phone", e.target.value)}
                  placeholder="0400 000 000"
                  required
                />
              </label>
              <label className="block">
                <span className={labelCls}>Suburb</span>
                <input
                  className={field}
                  value={form.suburb}
                  onChange={(e) => set("suburb", e.target.value)}
                  placeholder="Surry Hills"
                />
              </label>
            </div>
            <label className="block">
              <span className={labelCls}>About you</span>
              <textarea
                className={`${field} min-h-[80px]`}
                value={form.bio}
                onChange={(e) => set("bio", e.target.value)}
              />
            </label>
          </section>

          <section className={`${card} space-y-3`}>
            <h2 className="font-display text-lg font-semibold">ID document</h2>
            <p className="text-sm text-ink/55">
              Driver licence or passport. Stored privately — only you and the SydHub moderators can
              open it.
            </p>
            {p?.documents.length ? (
              <ul className="text-sm text-ink/70">
                {p.documents.map((d) => (
                  <li key={d.id}>
                    ✓ {d.label} — uploaded {new Date(d.created_at).toLocaleDateString("en-AU")}
                  </li>
                ))}
              </ul>
            ) : null}
            <input
              type="file"
              accept={DOC_TYPES}
              onChange={(e) => setDoc(e.target.files?.[0] ?? null)}
              className="text-sm"
            />
          </section>

          <section className={`${card} space-y-3`}>
            <h2 className="font-display text-lg font-semibold">Company</h2>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.isBusiness}
                onChange={(e) => set("isBusiness", e.target.checked)}
              />
              I post on behalf of a company or agency
            </label>
            {form.isBusiness && (
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className={labelCls}>Company name</span>
                  <input
                    className={field}
                    value={form.companyName}
                    onChange={(e) => set("companyName", e.target.value)}
                  />
                </label>
                <label className="block">
                  <span className={labelCls}>ABN</span>
                  <input
                    className={field}
                    value={form.abn}
                    onChange={(e) => set("abn", e.target.value)}
                    placeholder="11 digits"
                  />
                </label>
              </div>
            )}
          </section>

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={save.isPending}
              className="rounded-[10px] bg-brand px-5 py-2.5 text-sm font-semibold text-brand-foreground hover:bg-brand/90 disabled:opacity-60"
            >
              {save.isPending ? "Saving…" : "Save profile"}
            </button>
            <Link to="/dashboard" className="text-sm text-ink/55 hover:text-ink">
              Back to my activity
            </Link>
          </div>
        </form>
      </main>
    </div>
  );
}
