# Pin follows the address the user types

Right now the map pin starts at the centre of the chosen suburb and only moves if the poster clicks or drags the map. The pin should instead sit on the actual street address they entered.

## What changes

1. **Address → pin, automatically**
   - When the poster finishes typing the street address (or changes suburb/postcode), SydHub looks up "address, suburb NSW postcode, Australia" and drops the pin on the real location.
   - The lookup is debounced so it runs after typing pauses, not on every keystroke.

2. **Address suggestions while typing**
   - The street address field gets Google address autocomplete restricted to Australia, so picking a suggestion sets the pin exactly and also fills suburb/postcode when they're recognised.

3. **Clear feedback on the map card**
   - States shown under the map: "Locating address…", "Pinned to <matched address>", or "We couldn't find that address — drag the pin to the right spot."
   - Manual click/drag is still allowed and, once used, takes priority over the automatic lookup for that session (a small "Reset to address" link restores the automatic pin).

4. **Same behaviour on the wanted-ad form**
   - Wanted ads store suburbs rather than a street address, so their pin keeps following the selected suburbs — no change there unless you want it.

5. **Existing listings**
   - Listings already saved keep their stored coordinates; nothing is re-geocoded in bulk. Editing a listing's address will re-pin it.

## Technical notes

- Uses `google.maps.Geocoder` and the Places Autocomplete widget from the already-loaded Maps JS script (managed browser key), so no new server calls or secrets.
- `GoogleMap.tsx` gains a small helper export for geocoding; `post-listing.tsx` holds the new `pinSource` state ("address" vs "manual") and passes the resolved lat/lng to the existing insert.
- Falls back to the suburb centroid (current behaviour) when geocoding returns no result, so publishing is never blocked.
