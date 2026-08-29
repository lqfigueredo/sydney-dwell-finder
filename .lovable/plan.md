# Replace custom SVG map with Google Maps

Swap the custom Blueprint SVG map for a real interactive Google Map across SydHub, using the built-in Google Maps connection (no Google account needed).

## Steps

1. **Connect Google Maps (managed)**
   - Open the connect card for the Google Maps Platform connector; pick the managed option — no Google account or API key required.
   - This provides a browser key (safe to embed, referrer-restricted to the SydHub preview domain) for the Maps JavaScript API.
   - Note: if you later publish to a custom domain, that domain will need its own Google Cloud key — the managed key only works on the default preview/published domain.

2. **New `GoogleMap` component** (`src/components/GoogleMap.tsx`)
   - Loads the Maps JS API asynchronously (`loading=async` + `callback`), keeping SSR safe.
   - Classic `google.maps.Marker` pins (no mapId needed): teal pins for offered properties, sand pins for wanted ads.
   - Click a pin → info window with title, price, suburb, a link to the SydHub detail page, and a **"Get directions"** button that opens Google Maps directions (`google.com/maps/dir/?api=1&destination=lat,lng`) in a new tab.
   - Map styling kept subtle so pins stay readable; Blueprint Grid frame/labels kept around the map to preserve the visual direction.

3. **Replace `BlueprintMap` in all 4 places**
   - **Browse page** (`/`): markers for filtered results, viewport fits visible pins; filtering still drives the map.
   - **Listing detail**: single pin for the property, plus a "Get directions" link.
   - **Wanted ad detail**: pins for the sought suburbs/areas.
   - **Post a listing**: click (or drag a marker) on the map to set the property location — much friendlier than the current coordinate picker.

4. **Cleanup**: remove `BlueprintMap.tsx` and any now-unused projection helpers from `src/lib/marketplace.ts`; verify build and all four screens with the preview.

## Technical notes
- Browser key comes from `VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY`; loaded via script tag, never in server code.
- No server-side gateway calls needed for this step (map rendering + directions links are browser-only), so no usage-cost concerns.
- Existing filters, sort controls, and card lists are untouched — only the map surface changes.
