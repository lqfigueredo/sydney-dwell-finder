/** Seal shown next to members whose identity a moderator has confirmed. */
export function VerifiedSeal({ label = "Verified member" }: { label?: string }) {
  return (
    <span
      title="Identity confirmed by SydHub — posts go live without review"
      className="inline-flex items-center gap-1 rounded-full bg-brand/12 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-brand ring-1 ring-brand/25"
    >
      <svg viewBox="0 0 20 20" className="size-3 fill-current" aria-hidden="true">
        <path d="M10 1.5l2.2 1.6 2.7-.2.9 2.6 2.2 1.6-1 2.6 1 2.6-2.2 1.6-.9 2.6-2.7-.2L10 18.5l-2.2-1.6-2.7.2-.9-2.6L2 12.9l1-2.6-1-2.6 2.2-1.6.9-2.6 2.7.2L10 1.5zm-1 11.9l5-5-1.4-1.4L9 10.6 7.4 9 6 10.4l3 3z" />
      </svg>
      {label}
    </span>
  );
}
