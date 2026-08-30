# Verified seal: member request flow + admin review

## Goal
Members apply for the Verified seal by submitting ID/ownership documents. An admin reviews the documents and grants, rejects, or revokes the seal with a written reason. Only granted members skip photo review.

## Member flow
- New page **Get verified** (linked from the dashboard and from the "pending review" notice after posting).
- Shows current status: Not requested / Under review / Verified / Rejected (with the admin's reason) / Revoked (with reason).
- Request form: type of member (owner, agent, tenant/seeker), full name, contact phone, short note, and **document uploads** (photo ID plus optional proof of ownership/agency), image or PDF, max 10 MB each, at least one required.
- Documents go to a **new private storage bucket** (`verification-docs`). They are never public; only the owner and admins can view them, through short-lived signed URLs.
- One open request at a time. A rejected member can resubmit; a new request supersedes the old one.

## Admin flow
- New admin section **Verification** (tab in the admin console) listing pending requests first, then decided ones.
- Each request shows the member, their listings/ads count, submitted details, and a document viewer (signed thumbnails/links).
- Actions: **Grant seal**, **Reject** (reason required), and for already-verified members **Revoke** (reason required).
- The Members page keeps its quick toggle, but grant/revoke there also asks for a reason and records the same audit entry.
- Status is set explicitly by the admin, so an admin can also mark a request as **Needs more info** with a note back to the member.
- Every decision is written to the audit log with the admin id, member id, action, and reason.

## Effect on photos
- Unchanged rule: verified members' listings and wanted ads auto-approve; everyone else goes through the moderation queue.
- Revoking the seal does not hide already-approved posts; future posts return to review.

## Technical notes
- Migration:
  - `verification_requests` table: member id, requester type, full name, phone, note, status (`pending`, `needs_info`, `approved`, `rejected`), decision reason, reviewed_by, reviewed_at, timestamps. GRANTs plus RLS: member reads/creates their own, admins read and update all.
  - `verification_documents` table: request id, storage path, label, timestamps, same access rules.
  - `profiles`: add `verification_status` and `verification_note` so the member-facing state and last reason are readable without exposing the request rows.
  - Private bucket `verification-docs` with storage policies scoped to `auth.uid()` folder plus admin read.
- Server functions: `submitVerificationRequest`, `getMyVerificationStatus`, `getVerificationQueue` (admin), `decideVerification` (admin: grant/reject/needs_info/revoke, reason required for negative outcomes), and a signed-URL minter for documents mirroring `photos.functions.ts`.
- Admin actions extend the existing `runAdminAction` union in `src/lib/admin.functions.ts`; `user.verify` gains a `reason` field.
- Touched files: `src/lib/admin.functions.ts`, new `src/lib/verification.functions.ts`, new routes `src/routes/_authenticated/get-verified.tsx` and `src/routes/_authenticated/admin/verification.tsx`, `src/components/admin/AdminShell.tsx` (nav), `src/routes/_authenticated/admin/users.tsx`, `src/routes/_authenticated/dashboard.tsx`.

## Verification
- Normal test user submits a request with a document, sees "Under review", and posts still go to moderation.
- Admin sees the request, opens the document, grants the seal with a reason; member's next listing goes live instantly with the badge.
- Admin revokes with a reason; member sees the reason and the next post returns to review.
- A second member cannot read the first member's request or documents.
