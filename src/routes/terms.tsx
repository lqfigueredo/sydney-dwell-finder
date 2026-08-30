import { createFileRoute } from "@tanstack/react-router";
import { AppHeader } from "@/components/AppHeader";
import { TERMS_UPDATED_AT, TERMS_VERSION } from "@/lib/terms";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Use & Privacy Policy — SydHub Sydney" },
      {
        name: "description",
        content:
          "The rules for using SydHub: listing Sydney properties, posting wanted ads, photo review, and how we handle your personal information.",
      },
      { property: "og:title", content: "Terms of Use & Privacy Policy — SydHub" },
      {
        property: "og:description",
        content: "How SydHub works, what you agree to, and how we handle your data.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <div className="min-h-screen bg-canvas text-ink">
      <AppHeader />
      <main className="mx-auto max-w-[820px] px-6 py-10">
        <div className="blueprint-grid rounded-xl p-8 ring-1 ring-ink/10">
          <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-ink/40">
            Version {TERMS_VERSION} · Last updated {TERMS_UPDATED_AT}
          </p>
          <h1 className="mt-3 font-display text-3xl font-semibold">
            Terms of Use &amp; Privacy Policy
          </h1>
          <p className="mt-3 max-w-lg text-sm text-ink/60">
            These terms apply to everyone who uses SydHub, whether you list a property, post a
            wanted ad, or simply browse the map.
          </p>
        </div>

        <Section title="1. Using SydHub">
          <p>
            SydHub is a Sydney property marketplace where owners and agents list properties and
            seekers post what they're looking for. You need an account to post, comment, apply, or
            save items. You must be at least 18 and provide accurate information about yourself and
            anything you post.
          </p>
        </Section>

        <Section title="2. Your content">
          <p>
            You keep ownership of the text and photos you upload, and you grant SydHub permission to
            display them on the site for as long as your post is live. You confirm that you have the
            right to publish every photo and detail you upload, and that they show the actual
            property being advertised.
          </p>
        </Section>

        <Section title="3. Review and moderation">
          <p>
            Listings and wanted ads are reviewed by a moderator before they become public, and
            photos stay hidden until that review is complete. Members holding a current verified
            seal publish immediately. We may pause, reject, remove individual photos, or take down
            any post that breaches these terms, and we may deactivate accounts that repeatedly do
            so.
          </p>
        </Section>

        <Section title="4. What you must not do">
          <ul className="list-disc space-y-1 pl-5">
            <li>Post misleading prices, fake addresses, or properties you don't represent.</li>
            <li>Upload photos that are offensive, unlawful, or not of the property.</li>
            <li>Discriminate against applicants or seekers in breach of Australian law.</li>
            <li>Harvest other members' contact details or send unsolicited marketing.</li>
            <li>Attempt to bypass moderation, verification, or account restrictions.</li>
          </ul>
        </Section>

        <Section title="5. No agency or guarantee">
          <p>
            SydHub is a listing platform, not a real estate agency. We don't inspect properties,
            verify every claim, arrange leases or sales, or hold funds. Any agreement you reach with
            another member is between you and them — make your own enquiries before paying anything.
          </p>
        </Section>

        <Section title="6. Verification">
          <p>
            The verified seal is granted at our discretion after a moderator reviews the documents
            you supply. It may carry an expiry date, and it can be revoked at any time with a
            reason. Documents you submit for verification are stored privately and are visible only
            to moderators.
          </p>
        </Section>

        <Section title="7. Privacy — what we collect">
          <ul className="list-disc space-y-1 pl-5">
            <li>Account details: email, display name, and optional phone, suburb and bio.</li>
            <li>Content you post: listings, wanted ads, comments, applications and photos.</li>
            <li>Verification documents, when you request the verified seal.</li>
            <li>Technical data: basic error and usage logs used to keep the site working.</li>
          </ul>
        </Section>

        <Section title="8. Privacy — how we use it">
          <p>
            We use your information to run the marketplace: to publish your posts, connect you with
            the other side of a deal, review content, prevent abuse, and support your account. Your
            display name, suburb and public posts are visible to anyone. Your email address,
            verification documents and private notes are not published. We don't sell your personal
            information.
          </p>
        </Section>

        <Section title="9. Your choices">
          <p>
            You can edit your profile and delete your own posts at any time. You may ask us to
            deactivate your account or to correct or remove your personal information; some records
            may be retained where the law requires it. Deactivated accounts have their listings and
            wanted ads hidden from the public.
          </p>
        </Section>

        <Section title="10. Changes to these terms">
          <p>
            If we make a material change we'll publish a new version here and ask you to accept it
            the next time you sign in. Continuing to use SydHub after accepting means you agree to
            the current version. These terms are governed by the laws of New South Wales,
            Australia.
          </p>
        </Section>
      </main>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6 rounded-xl bg-canvas p-6 ring-1 ring-ink/10">
      <h2 className="font-display text-lg font-semibold">{title}</h2>
      <div className="mt-2 space-y-2 text-sm leading-relaxed text-ink/70">{children}</div>
    </section>
  );
}
