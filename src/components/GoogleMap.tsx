import { useEffect, useRef, useState } from "react";
import { SYDNEY_CENTRE } from "@/lib/marketplace";

export type MapMarkerKind = "offered" | "wanted";

export type MapMarker = {
  id: string;
  lat: number;
  lng: number;
  kind: MapMarkerKind;
  title?: string;
  label?: string;
  price?: string;
  link?: string;
};

export type GoogleMapProps = {
  center?: { lat: number; lng: number };
  zoom?: number;
  markers?: MapMarker[];
  fitBounds?: boolean;
  activeId?: string | null;
  height?: string;
  onMapClick?: (lat: number, lng: number) => void;
  draggableMarker?: {
    lat: number;
    lng: number;
    onDragEnd: (lat: number, lng: number) => void;
  };
};

/* eslint-disable @typescript-eslint/no-explicit-any */
let loadPromise: Promise<any> | null = null;

function loadGoogleMaps(): Promise<any> {
  if (typeof window === "undefined") return Promise.resolve();
  const win = window as any;
  if (win.google?.maps) return Promise.resolve(win.google);
  if (loadPromise) return loadPromise;

  const key = import.meta.env["VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY"];
  const channel = import.meta.env["VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID"] ?? "1";
  if (!key) {
    return Promise.reject(new Error("Google Maps browser key is not configured"));
  }

  const callbackName = `__sydhubMapInit_${Date.now()}`;
  loadPromise = new Promise((resolve, reject) => {
    win[callbackName] = () => {
      resolve(win.google);
      delete win[callbackName];
    };
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(
      key,
    )}&loading=async&callback=${callbackName}&channel=${encodeURIComponent(channel)}`;
    script.async = true;
    script.onerror = () => reject(new Error("Google Maps script failed to load"));
    document.head.appendChild(script);
  });
  return loadPromise;
}

function pinIcon(kind: MapMarkerKind): any {
  const fill = kind === "offered" ? "#0F6F6C" : "#E4B363";
  const svg =
    kind === "offered"
      ? `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="44" viewBox="0 0 36 44"><path fill="${fill}" d="M18 0C8.06 0 0 8.06 0 18c0 13.5 18 26 18 26s18-12.5 18-26C36 8.06 27.94 0 18 0z"/><circle cx="18" cy="18" r="7" fill="#F7F5F0"/></svg>`
      : `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="44" viewBox="0 0 36 44"><path fill="${fill}" d="M18 0C8.06 0 0 8.06 0 18c0 13.5 18 26 18 26s18-12.5 18-26C36 8.06 27.94 0 18 0z"/><circle cx="18" cy="18" r="7" fill="#123B3A"/></svg>`;
  return {
    url: `data:image/svg+xml;base64,${btoa(svg)}`,
    scaledSize: new (window as any).google.maps.Size(36, 44),
    anchor: new (window as any).google.maps.Point(18, 44),
  };
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

const SUBTLE_MAP_STYLE = [
  { featureType: "poi", elementType: "labels", stylers: [{ visibility: "off" }] },
  { featureType: "transit", elementType: "labels", stylers: [{ visibility: "off" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#e8f0ef" }] },
  { featureType: "landscape", elementType: "geometry", stylers: [{ color: "#F7F5F0" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#ffffff" }] },
  { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#123B3A" }] },
  { featureType: "administrative", elementType: "labels.text.fill", stylers: [{ color: "#123B3A" }] },
];

export function GoogleMap({
  center = SYDNEY_CENTRE,
  zoom = 12,
  markers = [],
  fitBounds = true,
  activeId,
  height = "100%",
  onMapClick,
  draggableMarker,
}: GoogleMapProps) {
  const divRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const infoWindowRef = useRef<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  // Initialise the map once on mount.
  useEffect(() => {
    let mounted = true;
    loadGoogleMaps()
      .then((google: any) => {
        if (!mounted || !divRef.current) return;
        const map = new google.maps.Map(divRef.current, {
          center,
          zoom,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          zoomControl: true,
          styles: SUBTLE_MAP_STYLE,
        });
        mapRef.current = map;
        infoWindowRef.current = new google.maps.InfoWindow({ maxWidth: 260 });

        if (onMapClick) {
          map.addListener("click", (e: any) => {
            const latLng = e.latLng;
            if (latLng) onMapClick(latLng.lat(), latLng.lng());
          });
        }
        setReady(true);
      })
      .catch((err) => {
        console.error(err);
        setError(err instanceof Error ? err.message : "Could not load Google Maps");
      });
    return () => {
      mounted = false;
    };
  }, []);

  // Pan / zoom when props change after init.
  useEffect(() => {
    if (!ready || !mapRef.current) return;
    mapRef.current.setCenter(center);
    mapRef.current.setZoom(zoom);
  }, [ready, center, zoom]);

  // Render / update markers.
  useEffect(() => {
    if (!ready || !mapRef.current || !infoWindowRef.current) return;
    const google = (window as any).google;
    const map = mapRef.current;

    // Clear previous markers.
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];

    const allPositions: any[] = [];

    markers.forEach((m) => {
      const position = new google.maps.LatLng(m.lat, m.lng);
      allPositions.push(position);
      const marker = new google.maps.Marker({
        position,
        map,
        icon: pinIcon(m.kind),
        animation: m.id === activeId ? google.maps.Animation.BOUNCE : null,
      });

      const content = `
        <div style="font-family: Figtree, ui-sans-serif, system-ui, sans-serif; color: #123B3A; min-width: 160px;">
          ${m.title ? `<div style="font-weight:700; font-size:14px; margin-bottom:4px; line-height:1.25;">${escapeHtml(m.title)}</div>` : ""}
          ${m.price ? `<div style="font-size:13px; color:#0F6F6C; font-weight:600; margin-bottom:4px;">${escapeHtml(m.price)}</div>` : ""}
          ${m.label ? `<div style="font-size:12px; color:#123B3A; opacity:0.7; margin-bottom:10px;">${escapeHtml(m.label)}</div>` : ""}
          <div style="display:flex; gap:12px;">
            ${m.link ? `<a href="${m.link}" target="_blank" style="font-size:12px; color:#0F6F6C; font-weight:600; text-decoration:none;">View →</a>` : ""}
            <a href="https://www.google.com/maps/dir/?api=1&destination=${m.lat},${m.lng}" target="_blank" style="font-size:12px; color:#0F6F6C; font-weight:600; text-decoration:none;">Get directions</a>
          </div>
        </div>
      `;

      marker.addListener("click", () => {
        infoWindowRef.current.setContent(content);
        infoWindowRef.current.open(map, marker);
      });

      markersRef.current.push(marker);
    });

    // Draggable marker for "drop a pin" flows.
    if (draggableMarker) {
      const position = new google.maps.LatLng(draggableMarker.lat, draggableMarker.lng);
      allPositions.push(position);
      const marker = new google.maps.Marker({
        position,
        map,
        icon: pinIcon("offered"),
        draggable: true,
      });
      marker.addListener("dragend", (e: any) => {
        const latLng = e.latLng;
        if (latLng) draggableMarker.onDragEnd(latLng.lat(), latLng.lng());
      });
      markersRef.current.push(marker);
    }

    if (fitBounds) {
      if (allPositions.length === 0) {
        map.setCenter(center);
        map.setZoom(zoom);
      } else if (allPositions.length === 1) {
        map.setCenter(allPositions[0]);
        map.setZoom(15);
      } else {
        const bounds = new google.maps.LatLngBounds();
        allPositions.forEach((p) => bounds.extend(p));
        map.fitBounds(bounds, { top: 40, right: 40, bottom: 40, left: 40 });
      }
    }

    // Open the active marker's info window.
    if (activeId) {
      const idx = markers.findIndex((m) => m.id === activeId);
      const activeMarker = markers[idx];
      const markerInstance = markersRef.current[idx];
      if (activeMarker && markerInstance) {
        const m = activeMarker;
        const content = `
          <div style="font-family: Figtree, ui-sans-serif, system-ui, sans-serif; color: #123B3A; min-width: 160px;">
            ${m.title ? `<div style="font-weight:700; font-size:14px; margin-bottom:4px; line-height:1.25;">${escapeHtml(m.title)}</div>` : ""}
            ${m.price ? `<div style="font-size:13px; color:#0F6F6C; font-weight:600; margin-bottom:4px;">${escapeHtml(m.price)}</div>` : ""}
            ${m.label ? `<div style="font-size:12px; color:#123B3A; opacity:0.7; margin-bottom:10px;">${escapeHtml(m.label)}</div>` : ""}
            <div style="display:flex; gap:12px;">
              ${m.link ? `<a href="${m.link}" target="_blank" style="font-size:12px; color:#0F6F6C; font-weight:600; text-decoration:none;">View →</a>` : ""}
              <a href="https://www.google.com/maps/dir/?api=1&destination=${m.lat},${m.lng}" target="_blank" style="font-size:12px; color:#0F6F6C; font-weight:600; text-decoration:none;">Get directions</a>
            </div>
          </div>
        `;
        infoWindowRef.current.setContent(content);
        infoWindowRef.current.open(map, markerInstance);
      }
    }
  }, [ready, markers, draggableMarker, activeId, fitBounds, center, zoom]);

  if (error) {
    return (
      <div
        className="blueprint-grid grid h-full w-full place-items-center rounded-xl bg-canvas p-4 text-center ring-1 ring-ink/10"
        style={{ height }}
      >
        <div>
          <p className="text-sm font-medium text-ink">Map unavailable</p>
          <p className="mt-1 text-xs text-ink/55">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={divRef}
      className="h-full w-full overflow-hidden rounded-xl ring-1 ring-ink/10"
      style={{ height }}
      aria-label="Google Map"
    />
  );
}
