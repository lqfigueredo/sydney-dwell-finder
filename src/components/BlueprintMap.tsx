import { useCallback, useEffect, useRef, useState } from "react";
import { project } from "@/lib/marketplace";

export type MapPin = {
  id: string;
  lat: number;
  lng: number;
  label: string;
  kind: "offered" | "wanted";
};

type Props = {
  pins: MapPin[];
  activeId?: string | null;
  onSelect?: (id: string) => void;
  /** When set, clicking the surface reports the lat/lng of that point. */
  onPick?: (coords: { lat: number; lng: number }) => void;
};

const MIN_ZOOM = 1;
const MAX_ZOOM = 6;

const REGIONS = [
  { label: "Inner West", x: 0.16, y: 0.55 },
  { label: "Eastern Suburbs", x: 0.72, y: 0.44 },
  { label: "Northern Beaches", x: 0.84, y: 0.1 },
  { label: "Sydney Harbour", x: 0.5, y: 0.36 },
];

export function BlueprintMap({ pins, activeId, onSelect, onPick }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const stateRef = useRef({ zoom, offset });
  stateRef.current = { zoom, offset };

  const dragRef = useRef<{ x: number; y: number; ox: number; oy: number; moved: boolean } | null>(
    null,
  );

  const handleWheel = useCallback((e: WheelEvent) => {
    const el = containerRef.current;
    if (!el) return;
    const { zoom: z, offset: o } = stateRef.current;
    const dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 100 : 1);
    const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z * Math.exp(-dy * 0.0015)));
    if (next === z) return;
    const rect = el.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const k = next / z;
    setZoom(next);
    setOffset({ x: px - (px - o.x) * k, y: py - (py - o.y) * k });
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const listener = (e: WheelEvent) => {
      e.preventDefault();
      handleWheel(e);
    };
    el.addEventListener("wheel", listener, { passive: false });
    return () => el.removeEventListener("wheel", listener);
  }, [handleWheel]);

  const zoomBy = (factor: number) => {
    const el = containerRef.current;
    if (!el) return;
    const { zoom: z, offset: o } = stateRef.current;
    const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z * factor));
    const rect = el.getBoundingClientRect();
    const px = rect.width / 2;
    const py = rect.height / 2;
    const k = next / z;
    setZoom(next);
    setOffset({ x: px - (px - o.x) * k, y: py - (py - o.y) * k });
  };

  const reset = () => {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  };

  const onPointerDown = (e: React.PointerEvent) => {
    dragRef.current = {
      x: e.clientX,
      y: e.clientY,
      ox: offset.x,
      oy: offset.y,
      moved: false,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) d.moved = true;
    setOffset({ x: d.ox + dx, y: d.oy + dy });
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const d = dragRef.current;
    dragRef.current = null;
    if (!d || d.moved || !onPick) return;
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const { zoom: z, offset: o } = stateRef.current;
    const u = (e.clientX - rect.left - o.x) / (rect.width * z);
    const v = (e.clientY - rect.top - o.y) / (rect.height * z);
    onPick({
      lng: 150.98 + u * (151.32 - 150.98),
      lat: -33.74 + v * (-34.02 - -33.74),
    });
  };

  return (
    <div
      ref={containerRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      className="relative h-full w-full touch-none overflow-hidden rounded-xl bg-canvas ring-1 ring-ink/10"
      style={{ cursor: onPick ? "crosshair" : "grab" }}
    >
      <div
        className="absolute inset-0 origin-top-left"
        style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})` }}
      >
        <div className="blueprint-grid absolute inset-0" />

        {/* Harbour + coastline sketch */}
        <div className="pointer-events-none absolute left-[30%] top-[30%] h-[16%] w-[42%] -rotate-[6deg] rounded-[45%] bg-brand/12" />
        <div className="pointer-events-none absolute left-[34%] top-[37%] h-px w-[34%] -rotate-[6deg] bg-brand/25" />
        <div className="pointer-events-none absolute right-0 top-0 h-full w-[14%] bg-brand/8" />

        {REGIONS.map((r) => (
          <span
            key={r.label}
            className="pointer-events-none absolute -translate-x-1/2 text-[10px] font-medium uppercase tracking-[0.2em] text-ink/30"
            style={{ left: `${r.x * 100}%`, top: `${r.y * 100}%` }}
          >
            {r.label}
          </span>
        ))}

        {pins.map((pin) => {
          const { x, y } = project(pin.lat, pin.lng);
          const active = pin.id === activeId;
          return (
            <button
              key={pin.id}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSelect?.(pin.id);
              }}
              className="absolute -translate-x-1/2 -translate-y-1/2"
              style={{
                left: `${x * 100}%`,
                top: `${y * 100}%`,
                transform: `translate(-50%, -50%) scale(${1 / zoom})`,
              }}
            >
              <span className="relative flex items-center">
                <span
                  className={`size-2.5 rounded-full ${
                    pin.kind === "wanted" ? "bg-brand" : "bg-accent"
                  } ${active ? "ring-4" : "ring-2"} ${
                    pin.kind === "wanted" ? "ring-brand/25" : "ring-accent/30"
                  }`}
                />
                <span
                  className={`ml-1.5 whitespace-nowrap rounded-lg px-2 py-0.5 text-[11px] font-medium ring-1 ${
                    active
                      ? "bg-ink text-canvas ring-ink/20"
                      : pin.kind === "wanted"
                        ? "bg-canvas text-brand ring-brand/20"
                        : "bg-canvas text-ink ring-ink/10"
                  }`}
                >
                  {pin.label}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="absolute bottom-4 left-4 rounded-[10px] bg-canvas/90 px-3 py-2 ring-1 ring-ink/10">
        <div className="flex items-center gap-4 text-[11px] font-medium text-ink/60">
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-accent" />
            Offered
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-brand" />
            Wanted
          </span>
        </div>
      </div>

      <div className="absolute right-4 top-4 flex flex-col overflow-hidden rounded-[10px] bg-canvas/90 ring-1 ring-ink/10">
        <button
          type="button"
          onClick={() => zoomBy(1.4)}
          className="px-2.5 py-1 text-sm font-medium text-ink/70 hover:bg-ink/5"
          aria-label="Zoom in"
        >
          +
        </button>
        <button
          type="button"
          onClick={() => zoomBy(1 / 1.4)}
          className="border-t border-ink/10 px-2.5 py-1 text-sm font-medium text-ink/70 hover:bg-ink/5"
          aria-label="Zoom out"
        >
          −
        </button>
        <button
          type="button"
          onClick={reset}
          className="border-t border-ink/10 px-2.5 py-1 text-[10px] font-medium text-ink/50 hover:bg-ink/5"
        >
          fit
        </button>
      </div>

      <div className="absolute bottom-4 right-4 flex items-center gap-2 text-[10px] font-medium text-ink/40">
        <span className="h-px w-10 bg-ink/30" />2 km
      </div>
    </div>
  );
}
