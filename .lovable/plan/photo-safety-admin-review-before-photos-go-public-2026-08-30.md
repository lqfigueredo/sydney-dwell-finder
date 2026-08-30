# Photo safety: admin review before photos go public

## Goal
No property photo is visible to the public until an admin has reviewed it. Admins can inspect every photo in the moderation queue and remove individual bad photos.

## Current gap (confirmed in code)
- Photos are uploaded to the private `property-photos` bucket, but the app stores a **1-year signed URL** on the listing (`cover_url` / `listing_photos.url`). Anyone with that link can view the photo — even while the listing is still pending review. So today, photos effectively bypass moderation.

## What we'll build

### 1. Photos only served after approval
- Store the storage **file path** (not a long-lived signed URL) in `listing_photos.url` and `listings.cover_url`.
- Add a server function `getListingPhotos(listingId)` that:
  - Returns fresh short-lived signed URLs (e.g. 1 hour) **only if** the listing is approved, OR the caller is the owner or an admin.
  - Pending/rejected listings: photos are returned only to owner + admin.
- Update the listing detail page, browse cards, and dashboard thumbnails to use this instead of raw stored URLs.

### 2. Photo review in the admin moderation queue
- Moderation queue shows **all photos of each pending listing** as a thumbnail strip (admins always get signed URLs).
- Approve / reject listing buttons stay as-is — approving a listing approves its photos.

### 3. Remove individual photos
- New admin action per photo: **Remove photo** (with a reason), available in the moderation queue and the admin listings table.
- Removing a photo deletes the storage object + `listing_photos` row, clears `cover_url` if it was the cover, and logs the action in `admin_error_logs` (as an audit entry).
- The owner sees a note on their dashboard: "A photo was removed by moderation" on the affected listing.

### 4. New photos on a live listing re-enter review
- If an owner adds photos to an already-approved listing, the listing flips back to `pending` automatically so the new photos get reviewed before going public.
- Editing text fields only (price, description) does **not** re-trigger review.

### 5. Upload hygiene (light validation)
- Client + server check: image MIME types only (jpg/png/webp), max 10 MB per file — blocks obviously wrong files before an admin ever sees them.

### 6. Verified seal — trusted users skip photo review
- Admins can grant a **Verified** seal to a user (a `trusted` role in the existing roles table, or a `verified_at` field on the profile).
- Listings from a verified user are **auto-approved on submit** — photos go live immediately, no moderation queue step.
- The seal shows as a badge on their listings, wanted ads, and profile ("Verified member"), so buyers/renters can see it.
- Admins manage it from the Members page: **Grant verified / Revoke verified**, with the action recorded in the audit log.
- Revoking the seal does not retroactively hide already-approved listings, but future submissions go back through review.
- Admins can still remove a bad photo or pause a listing from a verified user at any time — the seal is a fast lane, not immunity.

## Technical notes
- Migration: add `'trusted'` to the `app_role` enum (or `profiles.verified_at`), plus a policy/helper so verified status is publicly readable for the badge.
- Auto-approve happens server-side on insert (a trigger or the create server function checking verified status) — never trusted from the client.
- `post-listing.tsx`, `post-wanted.tsx`, `listings.$id.tsx`, browse cards in `index.tsx`, `admin.functions.ts`, `admin/moderation.tsx`, `admin/users.tsx` are the touched files.
- Existing seeded/1-year URLs keep working until they expire; new uploads use paths.

## Verification
- Post a listing as a normal test user: photos are NOT publicly viewable before approval; admin reviews photos in the queue, approves → photos go public.
- Grant the seal to a test user, post again → listing and photos go live instantly with the Verified badge.
- Admin removes one photo → owner sees the note, photo gone everywhere.

