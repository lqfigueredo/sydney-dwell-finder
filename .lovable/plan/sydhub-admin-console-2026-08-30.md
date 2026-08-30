# SydHub admin console

There is no admin interface today. The app has browse, listing/wanted detail, posting forms,
and a personal "My activity" dashboard — nothing that lets you oversee the whole marketplace.
The database also has no roles table, so nobody is an admin yet.

## What gets built

### 1. Admin roles (security first)
- A separate `user_roles` table with an `admin` / `moderator` / `user` role type, plus a
  `has_role` check used by all access rules. Roles are never stored on the profile.
- You get the first admin role assigned directly in the database.
- Only admins can read the admin views; everyone else is redirected away.

### 2. Admin overview page (`/admin`)
Top row of live counters:
- Total properties listed (published vs unpublished)
- Total wanted ads (open vs closed)
- Registered users
- Applications (pending / accepted / declined)
- Comments posted
- Photos uploaded
- New activity in the last 7 days

Plus a short "health" strip: listings missing a map location, listings without photos,
wanted ads with no suburbs — the things that make the site look broken to visitors.

### 3. Management tables
Tabbed sections, each searchable and sortable, with row actions:
- **Listings** — title, suburb, deal, price, owner, created date. Actions: view, unpublish/republish, delete.
- **Wanted ads** — title, suburbs, budget, seeker, open/closed. Actions: view, close/reopen, delete.
- **Users** — display name, suburb, join date, counts of their listings/wanted ads. Action: grant or revoke admin.
- **Applications** — who applied to what, status, date. Read-only.
- **Comments** — body preview, author, what it's attached to. Action: delete.

### 4. Access point
An "Admin" link appears in the header only for admin accounts.

## Technical notes

- New `user_roles` table + `has_role(user_id, role)` security-definer function; admin-read
  policies added to `listings`, `wanted_ads`, `applications`, `comments`, `profiles` so admins
  can see rows the public policies hide (unpublished listings, all applications).
- Admin data is fetched through authenticated server functions under `src/lib/admin.functions.ts`
  that verify the caller's admin role server-side before returning anything — never a
  client-side role check.
- Routes: `src/routes/_authenticated/admin.tsx` (overview + tabs), gated by an admin check that
  redirects non-admins to `/dashboard`.
- Counts come from indexed `count` queries, not full table reads.
