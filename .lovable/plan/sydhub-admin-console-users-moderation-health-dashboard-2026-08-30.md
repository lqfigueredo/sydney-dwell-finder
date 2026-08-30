# SydHub Admin Console — Users, Moderation, Health, Dashboard

Today `/admin` is a single page with counters and basic tables. This turns it into a proper console with four sections under `/admin`, sharing one tabbed layout and header link.

## 1. Dashboard (`/admin`)

- Totals: listings, wanted ads, members, applications, comments.
- Active vs inactive breakdown for listings (published/hidden/pending/rejected/paused) and wanted ads (open/closed).
- New submissions over time: a simple bar chart of listings and wanted ads created per day for the last 30 days, plus 7-day and 30-day totals.
- "Needs attention" tile: items waiting in the moderation queue, listings with no photos or no map pin.

## 2. User management (`/admin/users`)

- Search members by display name, suburb or account id.
- Detail panel per member: profile info, join date, admin role, counts of their listings, wanted ads, applications and comments.
- Grant/revoke admin (already exists, moves here).
- Deactivate / reactivate an account. Deactivation is a soft state: the member can still sign in, but their listings and wanted ads stop being publicly visible and they cannot create or edit content. Admins cannot deactivate themselves.

## 3. Moderation queue (`/admin/moderation`)

- Listings and wanted ads both get a moderation status: `pending`, `approved`, `rejected`, `paused`.
- Queue view filtered by status, with the item preview (title, suburb, price, photo, owner) and Approve / Reject / Pause actions, plus an optional reason on reject.
- Existing content is migrated as approved so nothing disappears. New submissions land as `pending` and are only publicly visible once approved.
- Rejection reason is shown to the owner on their own dashboard.

## 4. System health (`/admin/health`)

- Integration status checks run server-side on demand: database (round-trip query), auth (session/user lookup), storage (photo bucket reachable), Google Maps (browser key configured + Maps API reachable). Each renders as OK / degraded / failed with latency.
- Recent errors: a small `admin_error_logs` table that captures server-function failures and client runtime errors, shown newest-first with message, route and time, with a clear-log action.

## Technical notes

- Migration: add `moderation_status` enum + column on `listings` and `wanted_ads` (default `pending`, existing rows set to `approved`), `rejection_reason` text, `profiles.deactivated_at`, and an `admin_error_logs` table with admin-only read/delete and service-role insert. Public read policies on listings/wanted ads tighten to approved + owner-not-deactivated; owner and admin read paths stay so authors still see their own pending/rejected items.
- Server functions in `src/lib/admin.functions.ts` (all re-verify `has_role(admin)`): extend `getAdminSnapshot`, add `getAdminUserDetail`, `getSystemHealth`, `logAdminError`, and new action kinds for moderation and deactivation.
- Routes: convert `src/routes/_authenticated/admin.tsx` into a layout with `admin/index.tsx`, `admin/users.tsx`, `admin/moderation.tsx`, `admin/health.tsx`, keeping the current Blueprint Grid styling and design tokens.
- Posting forms and public browse/detail queries updated for the new status field; the member dashboard shows moderation state and rejection reason.
