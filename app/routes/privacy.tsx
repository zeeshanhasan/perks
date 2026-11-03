import type { MetaFunction } from "react-router";

export const meta: MetaFunction = () => [{ title: "Tofo Perks: Privacy policy" }];

const S = {
  page: { maxWidth: 720, margin: "48px auto", padding: "0 20px", font: "16px/1.6 Inter, system-ui, sans-serif", color: "#1a1a1a" },
  h1: { fontSize: 28, margin: "0 0 4px" },
  h2: { fontSize: 18, margin: "28px 0 8px" },
  muted: { color: "#616161", margin: "0 0 24px" },
} as const;

export default function Privacy() {
  return (
    <main style={S.page}>
      <h1 style={S.h1}>Tofo Perks: Privacy policy</h1>
      <p style={S.muted}>Last updated: 3 November 2026</p>

      <p>
        Tofo Perks (&ldquo;the App&rdquo;) is provided by Tofoapp to Shopify merchants. This policy explains what the
        App collects when a merchant installs it, and how that data is used.
      </p>

      <h2 style={S.h2}>What we collect</h2>
      <ul>
        <li>
          <strong>Merchant data:</strong> store domain, app settings (partner company name, email domains, discount
          settings, product selections), and an access token issued by Shopify.
        </li>
        <li>
          <strong>Customer data, processed for the merchant:</strong>
          <ul>
            <li>the Shopify customer ID</li>
            <li>
              the work email address, if the customer verifies one through the App, or their account email if it
              matches an approved company domain
            </li>
            <li>verification records (when a link was requested or used); links are stored only as one-way hashes</li>
            <li>an activity log of perk changes, with emails partly hidden</li>
          </ul>
        </li>
      </ul>
      <p>We don&apos;t collect payment details, addresses or phone numbers.</p>

      <h2 style={S.h2}>How we use it</h2>
      <p>
        Only to decide whether a customer gets the merchant&apos;s employee perks, and to show the merchant who has
        access. We never use it for marketing.
      </p>

      <h2 style={S.h2}>Sharing</h2>
      <p>
        We don&apos;t sell or share personal data. It&apos;s processed only by our hosting provider and our email
        provider, which sends verification emails, to run the App.
      </p>

      <h2 style={S.h2}>Retention and deletion</h2>
      <ul>
        <li>Customer data is deleted when Shopify sends a customer redaction request.</li>
        <li>All store data is deleted 48 hours after the app is uninstalled, when Shopify sends a shop redaction request.</li>
        <li>Unused verification links are deleted after 7 days.</li>
      </ul>

      <h2 style={S.h2}>Your rights</h2>
      <p>
        Customers can ask the merchant for access to, or deletion of, their data. Merchants can contact us at{" "}
        <a href="mailto:support@tofoapp.com">support@tofoapp.com</a>.
      </p>

      <h2 style={S.h2}>Contact</h2>
      <p>
        Tofoapp, <a href="mailto:support@tofoapp.com">support@tofoapp.com</a>
      </p>
    </main>
  );
}
