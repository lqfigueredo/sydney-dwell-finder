# Pre-publish test pass: filters + core flows

Goal: confirm the app does the core job well — find a unit/house to **buy or rent** in Sydney — and that everything works before publishing. No feature work planned; if a test fails I report it and propose the fix first.

## What already exists (checked in the code)

The browse screen already filters by:
- Rent vs Buy (mode toggle)
- Property type: Apartment, House, Townhouse, Studio, Land (multi-select)
- Min/max price, minimum bedrooms, keyword search
- Sort: newest, price low→high, price high→low
- Active-filter count badge, applied to both properties and wanted ads

So no filter is missing. The test pass verifies it behaves correctly with real data.

## Part A — Search and filters

For both Rent and Buy modes:
1. Type filter: select Apartment only, then House only, then both — result count and cards match the selection, and map pins update with the list.
2. Price range: set min and max, confirm nothing outside the range shows; rent prices read per week, sale prices as totals.
3. Bedrooms: 1+, 2+, 3+ each narrow correctly.
4. Sort: newest, price ascending, price descending each reorder correctly.
5. Combined filters plus a keyword, then clear all — count badge returns to zero and full results come back.
6. Same checks on the Wanted ads side.
7. Empty state: a filter combination with no matches shows a sensible message, not a blank panel.

## Part B — Core journey (unit, buy or rent)

8. Signed out: browse, open a listing detail, view photos, map, directions link, comments — all readable.
9. `user2@sydhub.test` posts a new apartment for rent with photos and a map pin; it shows "Awaiting review" and stays off public browse.
10. `admin@sydhub.test` approves it from moderation, including photo review; it then appears in browse and matches the Apartment + rent + price filters.
11. `user3@sydhub.test` posts a wanted ad (rent, apartment, budget); admin approves; `user2` applies with their listing; `user3` accepts; both sides see the status.
12. Comment on a listing from a second account and confirm both see it.
13. Rejection path: admin rejects an item with a reason; owner sees the reason, item stays off browse.

## Part C — Guardrails before publish

14. Normal user sees no Admin link, admin URLs show "Admins only", signed-out admin URLs redirect to sign-in; admin endpoints rejected server-side with a normal user's token.
15. Terms gate appears for a user who hasn't accepted, and sign-up requires the checkbox.
16. Verified seal: a verified member's post skips review; an expired seal does not.
17. Mobile width check on browse, listing detail and the post form.
18. Page titles/descriptions present on each public page, no console errors on the main routes.

## How it runs

Automated browser sessions against the live preview for each test account, plus direct API calls for the server-side authorisation checks. Output is a pass/fail table with screenshots of the key screens and a short list of anything to fix before publishing.
