import type { LinksFunction, MetaFunction } from "react-router";
import {
  CONTACT_EMAIL,
  PublicLayout,
  SITE_URL,
  publicLinks,
  publicStyles as s,
} from "../components/PublicLayout";

// DRAFT written from how the app works. Have it reviewed (ideally by a lawyer) before relying on it.

export const links: LinksFunction = publicLinks;

export const meta: MetaFunction = () => [
  { title: "Terms of service · Employee Perks" },
  {
    name: "description",
    content:
      "The terms for using Employee Perks, the employee discounts app for Shopify stores.",
  },
  { tagName: "link", rel: "canonical", href: `${SITE_URL}/terms` },
];

export default function Terms() {
  return (
    <PublicLayout>
      <main className={s.legal}>
        <div className={s.legalCard}>
          <h1>Terms of service</h1>
          <p className={s.updated}>Last updated: 20 November 2026</p>

          <p>
            These terms apply when a Shopify merchant (&ldquo;you&rdquo;)
            installs or uses Employee Perks (&ldquo;the App&rdquo;), provided by
            Zeeshan Hasan, trading as Tofoapp (&ldquo;Tofoapp&rdquo;,
            &ldquo;we&rdquo;). By installing the App you agree to them.
            If you don&apos;t agree, please don&apos;t install it, or uninstall
            it.
          </p>

          <h2>What the App does</h2>
          <p>
            The App lets you give employees of the businesses you add
            (&ldquo;partner companies&rdquo;) discounts, employee prices and
            employee-only products in your Shopify store, with limits, reports
            and invoices. It works through Shopify features: a discount, a
            checkout rule, a theme app embed and an app proxy page.
            Shopify&apos;s own terms also apply to your store.
          </p>

          <h2>Fees</h2>
          <p>
            The App costs $9 a month for stores on Shopify&apos;s Basic or
            Starter plan, and $19 a month for every other plan ($90 or $190 a
            year), after a 30-day free trial. Shopify bills it on your Shopify
            invoice, and you approve the plan in your Shopify admin. Your price
            is set by the Shopify plan you have when you first subscribe;
            upgrading Shopify later doesn&apos;t change it. Development stores
            are free. If your plan ends, employee discounts pause until you
            choose a plan again; employee-only products stay protected. We&apos;ll
            tell you at least 30 days before any price change, and you can
            cancel or uninstall at any time.
          </p>

          <h2>Your responsibilities</h2>
          <ul>
            <li>
              You decide who gets perks: the email domains, discounts, products
              and limits you set up, and any agreements you have with partner
              companies.
            </li>
            <li>
              You&apos;re responsible for the prices you charge, the taxes on
              them, and following the laws that apply to your store and your
              customers.
            </li>
            <li>
              Invoices created in the App are worked out from the orders
              recorded for each partner company. Check them before you send
              them. They can include employees&apos; work email addresses, so
              only share them with the company they&apos;re for.
            </li>
            <li>
              Don&apos;t use the App to break the law, Shopify&apos;s terms, or
              to get around them.
            </li>
          </ul>

          <h2>Your data</h2>
          <p>
            Your store&apos;s data stays yours. What we collect and how we
            delete it is in our <a href="/privacy">privacy policy</a>. When you
            uninstall, your data is deleted 48 hours later, when Shopify asks us
            to.
          </p>

          <h2>Data processing</h2>
          <p>
            For your customers&apos; personal data, you are the controller and
            we process it for you, only to run your perks program. In
            particular, we:
          </p>
          <ul>
            <li>
              use only the customer ID, the account email and recent orders,
              and only to decide who gets perks, apply limits, and build your
              reports and invoices. We never sell it or use it for marketing;
            </li>
            <li>
              keep it with our hosting provider only, encrypted in transit and
              at rest, and limit access to the people who run the App;
            </li>
            <li>
              delete a customer&apos;s data when Shopify sends us their
              deletion request, and all your store&apos;s data 48 hours after
              you uninstall;
            </li>
            <li>
              help you answer customers&apos; requests to see their data;
            </li>
            <li>
              tell you without undue delay, and within 72 hours, if a security
              incident affects your customers&apos; data.
            </li>
          </ul>

          <h2>Availability and changes</h2>
          <p>
            We work to keep the App running and correct, but we can&apos;t
            promise it will always be available or free of errors, and it
            depends on Shopify&apos;s services. The checkout rule is built to
            block employee-only products if something goes wrong. We may improve
            or change features; if a change takes something important away,
            we&apos;ll tell you first.
          </p>

          <h2>Liability</h2>
          <p>
            The App is provided &ldquo;as is&rdquo;. As far as the law allows,
            we&apos;re not liable for indirect losses, such as lost sales or
            profits, and our total liability is limited to what you paid us for
            the App in the 12 months before the claim.
          </p>

          <h2>Ending</h2>
          <p>
            You can stop at any time by uninstalling the App. We may suspend
            access if the App is used in breach of these terms. Discounts and
            checkout rules stop working as soon as the App is uninstalled.
          </p>

          <h2>Governing law</h2>
          <p>
            These terms are governed by the laws of England and Wales. Before
            going to court, we&apos;ll both try to settle any disagreement by
            email in good faith. If that doesn&apos;t work within 30 days, the
            courts of England and Wales will decide it.
          </p>

          <h2>Changes to these terms</h2>
          <p>
            We may update these terms. The date at the top shows the latest
            version, and we&apos;ll tell you about important changes before they
            apply.
          </p>

          <h2>Contact</h2>
          <p>
            Tofoapp, <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
          </p>
        </div>
      </main>
    </PublicLayout>
  );
}
