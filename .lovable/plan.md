# Verification pass: admin access control + full posting workflow

No app changes planned — this is an end-to-end test run against the live preview, using the four test accounts. If a test fails, I report it and propose a fix before changing anything.

## Part A — Admin access control

Signed in as `admin@sydhub.test`:
- Header shows the Admin link; `/admin`, `/admin/moderation`, `/admin/users`, `/admin/health` all load with real data.
- A moderation action (approve/pause) succeeds.

Signed in as `user1@sydhub.test` (normal user):
- Header shows no Admin link.
- Navigating directly to each admin URL shows the "Admins only" screen, not the console.
- Signed out: admin URLs redirect to `/auth`.

Server-side (the part that actually matters):
- Call the admin server endpoints directly with a normal user's token and with no token at all, confirming both are rejected rather than returning data.
- Attempt a moderation write and a role grant as a normal user directly against the database API — must be denied by the access rules, not just hidden in the UI.
- Confirm a normal user cannot read other people's pending/rejected items or the error log.

## Part B — Posting and proposal workflow

As `user2@sydhub.test`:
1. Post a new property: fill details, pick property type, upload a photo, drop a map pin, submit.
2. Confirm it appears on their dashboard marked "Awaiting review" and is NOT visible on public browse yet.

As `admin@sydhub.test`:
3. The new property appears in the moderation queue as pending. Approve it.

As anyone (including signed out):
4. The property now appears in browse, with photo, map pin and correct filters (price, beds, type, sort).
5. Open the detail page: photos, map, directions link, comments.

As `user3@sydhub.test`:
6. Post a wanted ad; admin approves it.
7. `user2` applies to that wanted ad with their approved property.
8. `user3` sees the application on their dashboard and can accept/decline; `user2` sees the status change.
9. Post a comment on the listing from a second account and confirm it shows for both.

Rejection path:
10. Admin rejects one item with a reason; the owner sees "Rejected: <reason>" on their dashboard and the item stays off public browse.

## How this is run

Automated browser sessions (Playwright) driving the real preview for each account, plus direct API calls for the server-side authorisation checks. I'll report a pass/fail table with screenshots of the key screens and flag anything that leaks data or lets a normal user act as admin.
