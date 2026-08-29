# Tidewater — Sydney two-way property marketplace

A marketplace where both sides post: owners list properties, and renters/buyers post
"wanted" ads describing what they're after. Either side can apply to the other.

Design is locked to the approved **Blueprint Grid** direction: cream canvas (#F7F5F0),
teal brand (#0F6F6C), sand accent (#E4B363), deep green ink (#123B3A), Outfit headings +
Figtree body, split map-and-list browse screen with a blueprint-style map surface.

## Step 1 — Foundation and browse screen

- Enable Lovable Cloud (database, auth, image storage) for the whole app.
- Build the browse page at `/` exactly as the chosen direction: header with logo,
  Properties/Wanted mode toggle, Log in + Create account; filter toolbar with counts;
  7/5 split of map panel and right column (detail preview card, results header,
  2-column card grid including the teal Wanted card, dashed "Post a wanted ad" button).
- Real map from the start using the Google Maps connector, styled to match the direction's
  cream/teal register with sand pins for offered and teal pins for wanted.

## Step 2 — Accounts

- Email + password sign up, log in, log out, password reset.
- A `profiles` record per user (display name, avatar, phone, whether they're a
  seeker or an owner — a user can be both).
- Header shows the signed-in user; posting and applying require an account.

## Step 3 — Property listings

- Post a listing: rent or sale, address with map-picked location, price (per week for
  rent, total for sale), beds/baths/parking, area, description, features.
- Multi-photo upload to Cloud storage with a gallery on the detail page.
- Listing detail page: photo gallery, price block, key details grid, map location,
  and the enquiry/comments thread from the direction.

## Step 4 — Wanted ads (the two-way half)

- Post a wanted ad: rent or buy, target suburbs, budget, bedrooms, must-haves,
  move-in date, free-text notes.
- Wanted ads appear as teal pins over their target suburbs and as cards in the list.
- Owners open a wanted ad and **apply** by attaching one of their listings plus a message.
- The seeker sees applications and can accept, decline, or reply.

## Step 5 — Messaging and dashboard

- Threaded comments on listings and wanted ads, plus private enquiry threads.
- "My activity": my listings, my wanted ads, applications sent, applications received,
  saved items.

## Technical notes

- Database tables: `profiles`, `listings`, `listing_photos`, `wanted_ads`,
  `applications`, `comments`, `saved_items`. Row-level security so anyone can read
  published listings and wanted ads, but only the owner can edit their own rows, and only
  the parties to an application can read it.
- Photos in a Cloud storage bucket, public read, owner-only write.
- Google Maps connector for map rendering, address autocomplete, and geocoding of
  listing addresses.
- Design tokens from the chosen direction go straight into `src/styles.css`; Outfit and
  Figtree loaded via a link tag in the root route.

## Approval

Each step ships on its own and you review before the next one starts.
