import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { initials } from "@/lib/marketplace";

type Row = {
  id: string;
  body: string;
  created_at: string;
  author_id: string | null;
  profiles: { display_name: string } | null;
};

export function CommentThread({ target }: { target: { listingId?: string; wantedId?: string } }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [body, setBody] = useState("");
  const key = ["comments", target.listingId ?? target.wantedId];

  const comments = useQuery({
    queryKey: key,
    queryFn: async () => {
      let q = supabase
        .from("comments")
        .select("id, body, created_at, author_id")
        .order("created_at", { ascending: true });
      q = target.listingId
        ? q.eq("listing_id", target.listingId)
        : q.eq("wanted_ad_id", target.wantedId!);
      const { data, error } = await q;
      if (error) throw error;

      const rows = data ?? [];
      const ids = [...new Set(rows.map((r) => r.author_id).filter(Boolean))] as string[];
      const names = new Map<string, string>();
      if (ids.length) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, display_name")
          .in("id", ids);
        for (const p of profiles ?? []) names.set(p.id, p.display_name);
      }

      return rows.map((r) => ({
        ...r,
        profiles: r.author_id
          ? { display_name: names.get(r.author_id) ?? "Member" }
          : null,
      })) as Row[];
    },
  });


  const post = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !body.trim()) return;
    const { error } = await supabase.from("comments").insert({
      author_id: user.id,
      body: body.trim(),
      listing_id: target.listingId ?? null,
      wanted_ad_id: target.wantedId ?? null,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    setBody("");
    void qc.invalidateQueries({ queryKey: key });
  };

  return (
    <section className="rounded-xl bg-canvas p-5 ring-1 ring-ink/10">
      <h2 className="font-display text-[15px] font-semibold">
        Questions & comments
        <span className="ml-2 text-[12px] font-normal text-ink/40">
          {comments.data?.length ?? 0}
        </span>
      </h2>

      <ul className="mt-4 space-y-4">
        {comments.data?.map((c) => (
          <li key={c.id} className="flex gap-3">
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-ink/[0.06] text-[11px] font-semibold text-ink/60">
              {initials(c.profiles?.display_name ?? "Member")}
            </span>
            <div className="min-w-0">
              <p className="text-[12px] font-medium text-ink/70">
                {c.profiles?.display_name || "Member"}
                <span className="ml-2 font-normal text-ink/35">
                  {new Date(c.created_at).toLocaleDateString("en-AU")}
                </span>
              </p>
              <p className="mt-0.5 text-sm text-ink/75">{c.body}</p>
            </div>
          </li>
        ))}
        {comments.data?.length === 0 && (
          <li className="text-sm text-ink/45">No comments yet — start the conversation.</li>
        )}
      </ul>

      {user ? (
        <form onSubmit={post} className="mt-5 flex gap-2">
          <input
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Ask about inspections, pets, parking…"
            className="flex-1 rounded-[10px] bg-ink/[0.04] px-3.5 py-2 text-sm outline-none ring-1 ring-transparent placeholder:text-ink/35 focus:ring-brand/40"
          />
          <button className="rounded-[10px] bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground hover:bg-brand/90">
            Post
          </button>
        </form>
      ) : (
        <p className="mt-5 text-[13px] text-ink/50">
          <Link to="/auth" className="font-medium text-brand">
            Log in
          </Link>{" "}
          to join the conversation.
        </p>
      )}
    </section>
  );
}
