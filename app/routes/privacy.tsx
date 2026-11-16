import type { LinksFunction, MetaFunction } from "react-router";
import {
  PublicLayout,
  SITE_URL,
  publicLinks,
  publicStyles as s,
} from "../components/PublicLayout";

export const links: LinksFunction = publicLinks;

export const meta: MetaFunction = () => [
  { title: "Privacy policy · Employee Perks" },
  {
    name: "description",
    content:
      "What Employee Perks collects when a Shopify merchant installs it, and how it is used and deleted.",
  },
  { tagName: "link", rel: "canonical", href: `${SITE_URL}/privacy` },
];

export default function Privacy() {
  return (
    <PublicLayout>
      <main className={s.legal}>
        <div className={s.legalCard}>
          <h1>Employee Perks: Privacy policy</h1>
          <p className={s.updated}>Last updated: 16 November 2026</p>

          <p>
            Employee Perks (&ldquo;the App&rdquo;) is provided by Tofoapp to
            Shopify merchants. This policy explains what the App collects when a
            merchant installs it, and how that data is used.
          </p>

          <h2>What we collect</h2>
          <ul>
            <li>
              <strong>Merchant data:</strong> store domain, app settings
              (partner company name, email domains, discount settings, product
              selections), and an access token issued by Shopify.
            </li>
            <li>
              <strong>Customer data, processed for the merchant:</strong>
              <ul>
                <li>the Shopify customer ID</li>
                <li>
                  their account email, when it matches an approved company
                  domain
                </li>
                <li>
                  an activity log of perk changes, with emails partly hidden
                </li>
              </ul>
            </li>
          </ul>
          <p>
            We don&apos;t collect payment details, addresses or phone numbers.
          </p>

          <h2>How we use it</h2>
          <p>
            Only to decide whether a customer gets the merchant&apos;s employee
            perks, and to show the merchant who has access. We never use it for
            marketing.
          </p>

          <h2>Sharing</h2>
          <p>
            We don&apos;t sell or share personal data. It&apos;s processed only
            by our hosting provider, to run the App. The App doesn&apos;t send
            emails.
          </p>

          <h2>Retention and deletion</h2>
          <ul>
            <li>
              Customer data is deleted when Shopify sends a customer redaction
              request.
            </li>
            <li>
              All store data is deleted 48 hours after the app is uninstalled,
              when Shopify sends a shop redaction request.
            </li>
          </ul>

          <h2>Your rights</h2>
          <p>
            Customers can ask the merchant for access to, or deletion of, their
            data. Merchants can contact us at{" "}
            <a href="mailto:hello@tofoapp.com">hello@tofoapp.com</a>.
          </p>

          <h2>Contact</h2>
          <p>
            Tofoapp, <a href="mailto:hello@tofoapp.com">hello@tofoapp.com</a>
          </p>
        </div>
      </main>
    </PublicLayout>
  );
}
