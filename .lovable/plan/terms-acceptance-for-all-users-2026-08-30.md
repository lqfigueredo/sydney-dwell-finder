# Terms acceptance for all users

Everyone who uses SydHub agrees to the Terms of Use and Privacy Policy — new
accounts at sign-up, and existing accounts the next time they sign in.

## What the user sees

- **Sign-up form**: a required checkbox — "I agree to the Terms of Use and Privacy
  Policy" — with both words linking to the new `/terms` page (opens in a new tab).
  The Create account button stays disabled until it's ticked.
- **New public page `/terms`**: Terms of Use and Privacy Policy sections in the
  SydHub blueprint style, with a visible "last updated" date and version label.
- **Existing members**: on their next visit to any signed-in page, a blocking
  dialog shows a short summary plus links to the full terms, with one Accept
  button. Nothing else in the app is usable until they accept or log out.
- **Re-acceptance**: when the terms version is bumped, the same dialog reappears
  for everyone once.
- **Dashboard**: a small line under the profile area — "Terms accepted on
  <date> (v1)" — so people can confirm their status.
- **Admin members page**: a column showing whether each member has accepted the
  current terms, so admins can see who is outstanding.

## Technical notes

- Migration adds `terms_accepted_at timestamptz` and `terms_version text` to
  `public.profiles`. No new table, no grant changes needed — profiles already
  allows self-update and public read.
- Current version constant (`TERMS_VERSION = "1"`) lives in `src/lib/terms.ts`
  alongside the terms copy metadata; the gate compares the stored version to it.
- Sign-up writes acceptance right after the session exists (in the auth page
  flow), so the checkbox value is never trusted from the client alone — the
  record is a self-update on the user's own profile row.
- A `TermsGate` component wraps the `_authenticated` layout outlet, reads the
  signed-in user's profile, and renders the dialog when acceptance is missing or
  stale. Loading state renders nothing to avoid a flash.
- `/terms` is a public route with its own head metadata (title, description,
  og tags).
