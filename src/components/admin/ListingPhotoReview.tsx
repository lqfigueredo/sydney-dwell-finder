import { useQuery } from "@tanstack/react-query";
import { getPrivateListingPhotos } from "@/lib/photos.functions";

/**
 * Thumbnail strip for the moderation queue. Photos are private until the
 * listing is approved, so links are signed server-side for admins only.
 */
export function ListingPhotoReview({
  listingId,
  onRemove,
}: {
  listingId: string;
  onRemove: (photoId: string, reason: string) => void;
}) {
  const q = useQuery({
    queryKey: ["admin-listing-photos", listingId],
    queryFn: () => getPrivateListingPhotos({ data: { listingId } }),
  });

  if (q.isLoading) return <p className="w-full text-xs text-ink/40">Loading photos…</p>;

  const photos = q.data?.photos ?? [];
  if (!photos.length)
    return <p className="w-full text-xs text-ink/40">No photos attached to this listing.</p>;

  return (
    <div className="w-full">
      <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-ink/40">
        Photos ({photos.length}) — check before approving
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        {photos.map((p) => (
          <figure key={p.id} className="group relative">
            <a href={p.url} target="_blank" rel="noreferrer">
              <img
                src={p.url}
                alt="Submitted listing photo awaiting review"
                loading="lazy"
                className="size-24 rounded-[10px] object-cover ring-1 ring-ink/10"
              />
            </a>
            <button
              type="button"
              onClick={() => {
                const reason = prompt("Why is this photo being removed? (shown to the owner)");
                if (reason === null) return;
                onRemove(p.id, reason.trim());
              }}
              className="absolute right-1 top-1 rounded-full bg-red-700 px-2 py-0.5 text-[10px] font-semibold text-white opacity-0 transition-opacity group-hover:opacity-100"
            >
              Remove
            </button>
          </figure>
        ))}
      </div>
    </div>
  );
}
