# Complete your profile before posting

Members must finish their profile — photo, ID document, and company details if they're posting as a business — before they can publish a listing or a wanted ad.

## What changes for members

1. **New "My profile" page** (`/profile`, linked from the header and dashboard)
   - Profile photo upload (shown on listings and comments).
   - Full name, phone, suburb, short bio.
   - ID document upload (driver licence or passport) — stored privately, never public.
   - "I'm posting on behalf of a company/agency" toggle; when on, company name and ABN are required.

2. **Posting is gated**
   - `/post-listing` and `/post-wanted` check the profile first. If anything is missing, the form is replaced by a short "Complete your profile to publish" card listing exactly what's missing, with a button to `/profile`.
   - The dashboard shows a profile-completeness banner with the same call to action.
   - The check is also enforced on the server, so a listing can't be created with an incomplete profile.

3. **Admin side**
   - The member list shows profile-complete status and company name.
   - Admins reviewing verification can see the ID document already on file, so members don't upload it twice.

## Definition of "complete"

Photo + full name + phone + ID document. Company name and ABN are required only when the member marks themselves as a business.

## Technical notes

- Migration on `public.profiles`: `id_document_path text`, `is_business boolean default false`, `company_name text`, `abn text`, plus a `profile_completed_at` timestamp maintained by a trigger. GRANTs and existing RLS stay as they are (owner-write, public read) — but ID document path and ABN move behind a `SECURITY DEFINER` accessor / restricted view so the public profile read never leaks them.
- Avatars go to a public `avatars` bucket (owner-write RLS); ID documents go to the existing private verification bucket with the same owner/admin-only policies used today.
- Gate helper `isProfileComplete(profile)` in `src/lib/marketplace.ts`, reused by the two posting routes and the dashboard banner.
- Server-side enforcement via a `createServerFn` with `requireSupabaseAuth` that validates completeness before insert, so the rule holds even if the UI is bypassed.
- Existing members with incomplete profiles keep their published content; the gate applies to new posts only.
