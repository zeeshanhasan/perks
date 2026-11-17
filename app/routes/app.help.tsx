import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { HelpRows, askRows, useSidekick } from "../components/AskHelp";
import { RouteError } from "../components/RouteError";
import { aiPrompt, guideUrl } from "../lib/ai-help";
import { themeEditorEmbedUrl } from "../lib/setup.server";
import { authenticate } from "../shopify.server";

const SUPPORT_EMAIL = "hello@tofoapp.com";
const WEBSITE = "https://perks.tofoapp.com";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  return {
    shop: session.shop,
    themeUrl: themeEditorEmbedUrl(session.shop, process.env.SHOPIFY_API_KEY || ""),
    askPrompt: aiPrompt(guideUrl(process.env.SHOPIFY_APP_URL || "")),
  };
};

function Faq({ q, children }: { q: string; children: React.ReactNode }) {
  return (
    <s-stack gap="small-200">
      <s-text type="strong">{q}</s-text>
      <s-paragraph>{children}</s-paragraph>
    </s-stack>
  );
}

const mail = (subject: string) => `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}`;

export default function Help() {
  const { shop, themeUrl, askPrompt } = useLoaderData<typeof loader>();
  const openSidekick = useSidekick();
  const verifyUrl = `https://${shop}/apps/perks/verify`;

  return (
    <s-page heading="Help">
      {/* ---------- Main column: how the app works, in the order of its pages ---------- */}
      <s-section heading="Get started in 4 steps">
        <s-ordered-list>
          <s-list-item>
            <strong>Add a business</strong> on <s-link href="/app/businesses">Businesses</s-link>: the company name, its
            work email domains (e.g. acme.com) and the discount its employees get.
          </s-list-item>
          <s-list-item>
            <strong>Turn on Employee mode</strong> in your theme from the <s-link href="/app/storefront">Storefront</s-link>{" "}
            page, so employees see their price and other shoppers don&apos;t see employee-only products.
          </s-list-item>
          <s-list-item>
            <strong>Tell the company&apos;s employees</strong>: they log in to your store with their work email. Share
            the <s-link href="/app/perks-page">Perks page</s-link> so they know what they get.
          </s-list-item>
          <s-list-item>
            <strong>Watch and bill</strong>: <s-link href="/app">Home</s-link> shows this month&apos;s numbers, and{" "}
            <s-link href="/app/reports">Reports</s-link> creates invoices for each company.
          </s-list-item>
        </s-ordered-list>
      </s-section>

      <s-section heading="How employees get perks">
        <s-stack gap="base">
          <s-unordered-list>
            <s-list-item>
              <strong>Work email login:</strong> a customer who logs in with an email at a business&apos;s domain gets its
              perks straight away. Shopify sends them a login code, which proves the email is theirs.
            </s-list-item>
            <s-list-item>
              <strong>Personal email accounts don&apos;t get perks:</strong> an employee whose store account uses gmail.com
              or similar logs out and logs in (or creates an account) with their work email instead.{" "}
              <s-link href={verifyUrl} target="_blank">
                /apps/perks/verify
              </s-link>{" "}
              on your store tells shoppers whether they get perks.
            </s-list-item>
            <s-list-item>
              <strong>Always logged in:</strong> perks only apply to logged-in customers. Guest checkout never gets them,
              whatever email is typed.
            </s-list-item>
          </s-unordered-list>
          <s-text color="subdued">
            Someone says they don&apos;t get the discount? <s-link href="/app/check">Check a customer</s-link> shows exactly
            why, with the fix.
          </s-text>
        </s-stack>
      </s-section>

      <s-section heading="Businesses">
        <s-unordered-list>
          <s-list-item>
            <strong>Domains:</strong> each business has its own work email domains. A domain can belong to only one
            business, and personal ones like gmail.com can&apos;t be added.
          </s-list-item>
          <s-list-item>
            <strong>Discount:</strong> a percentage off, or a fixed amount off each item (never more than its price).
          </s-list-item>
          <s-list-item>
            <strong>Limit per employee</strong> (optional): every month or every year, on the discount they get or on what
            they spend. It starts again on the 1st (or 1 January). By default the order that reaches the limit uses up
            what&apos;s left of it; untick that to make the item that goes past it full price.
          </s-list-item>
          <s-list-item>
            <strong>Discounted products:</strong> all products, or only some (products, collections, vendors, product
            types). Anyone can buy them; this business&apos;s employees pay less.
          </s-list-item>
          <s-list-item>
            <strong>Employee-only products</strong> (optional): only this business&apos;s employees can buy them. Everyone
            else is stopped at checkout, and with Employee mode on they&apos;re hidden from collections and search.
          </s-list-item>
          <s-list-item>
            <strong>Paused or deleted:</strong> pause a business to stop its perks for a while. Deleting it stops them for
            good; its orders and invoices stay in Reports.
          </s-list-item>
        </s-unordered-list>
      </s-section>

      <s-section heading="Employees">
        <s-unordered-list>
          <s-list-item>
            Everyone who gets perks appears on <s-link href="/app/employees">Employees</s-link>, with how they joined.
            &ldquo;Find existing employees&rdquo; adds customers who signed up before you installed the app.
          </s-list-item>
          <s-list-item>
            <strong>Remove perks</strong> when someone leaves the company. It works straight away, even if their email
            still matches the domain. You can restore them later.
          </s-list-item>
        </s-unordered-list>
      </s-section>

      <s-section heading="Storefront and the Perks page">
        <s-stack gap="base">
          <s-unordered-list>
            <s-list-item>
              <strong>Employee mode</strong> shows employees their price on product pages and product cards, hides
              employee-only products from everyone else, and shows a message instead of the buy button on them. Change
              its wording on <s-link href="/app/storefront">Storefront</s-link>.
            </s-list-item>
            <s-list-item>
              <strong>Perks page</strong>: a public page at /apps/perks listing your partner companies and their
              discounts. Switch it on, then add it to your store menu, on the{" "}
              <s-link href="/app/perks-page">Perks page</s-link> page.
            </s-list-item>
          </s-unordered-list>
          <s-box>
            <s-button href={themeUrl} target="_blank" icon="theme-edit">
              Open theme editor
            </s-button>
          </s-box>
        </s-stack>
      </s-section>

      <s-section heading="Reports and invoices">
        <s-unordered-list>
          <s-list-item>
            Every employee order is recorded against its business. <s-link href="/app/reports">Reports</s-link> shows
            orders, employees, spend and discount for any period, compared with the period before.
          </s-list-item>
          <s-list-item>
            <strong>Create invoice</strong> bills a company for the discount its employees received, or for their total
            spend. Print it or save it as a PDF, and download the Excel file with every item.
          </s-list-item>
          <s-list-item>
            Issued invoices never change. If an order is cancelled later, the invoice list says so.
          </s-list-item>
        </s-unordered-list>
      </s-section>

      <s-section heading="Settings">
        <s-paragraph>
          <s-link href="/app/settings">Settings</s-link> shows your plan (with <s-text type="strong">Manage plan</s-text> to
          change or cancel it), then three store-wide options: pause all perks at once, products that are never
          discounted, and whether the employee discount combines with your other discounts.
        </s-paragraph>
      </s-section>

      <s-section heading="Common questions">
        <s-stack gap="base">
          <Faq q="Can someone get the discount by typing a work email at checkout?">
            No. Perks only apply to logged-in customers, and the email is proved by Shopify&apos;s login code.
          </Faq>
          <Faq q="Can other shoppers see employee-only products?">
            With Employee mode on, they&apos;re hidden from collections and search, and their pages show a message
            instead of a buy button. Someone with a direct link can still see the page, but checkout always blocks them.
          </Faq>
          <Faq q="Does the discount stack with my sales?">
            Only if you allow it under Settings, &ldquo;Combining with other discounts&rdquo;. Otherwise Shopify gives the
            better discount.
          </Faq>
          <Faq q="How much does it cost?">
            $9 a month on Shopify&apos;s Basic or Starter plan, $19 a month on any other plan, after a 30-day free
            trial. Every feature is included in both, and Shopify bills it on your Shopify invoice. If your plan ends,
            employee discounts pause until you choose a plan again.
          </Faq>
          <Faq q="Why don't gift cards get an employee price?">Shopify never discounts gift cards.</Faq>
          <Faq q="Is it safe to uninstall?">
            Yes. The app never edits your theme code, so nothing is left behind. The discount and checkout rule stop
            straight away, employee-only products become normal products (unpublish them first if they must stay private),
            and your app data is deleted 48 hours later.
          </Faq>
        </s-stack>
      </s-section>

      {/* ---------- Right column: help, feedback, contact ---------- */}
      <s-box slot="aside">
        <s-stack gap="base">
          <s-section heading="Get help">
            <s-stack gap="small">
              <s-text color="subdued">Ask an assistant. Each one opens a chat that already knows this app.</s-text>
              <HelpRows rows={askRows(askPrompt, openSidekick, true)} />
            </s-stack>
          </s-section>

          <s-section heading="Feedback & feature requests">
            <s-stack gap="small">
              <s-paragraph>Something missing, confusing or broken? Tell us. We read every message.</s-paragraph>
              <s-stack direction="inline" gap="small">
                <s-button href={mail("Feature request: Employee Perks")} target="_blank" icon="lightbulb">
                  Request a feature
                </s-button>
                <s-button href={mail("Feedback: Employee Perks")} target="_blank" variant="tertiary">
                  Send feedback
                </s-button>
              </s-stack>
            </s-stack>
          </s-section>

          <s-section heading="Contact">
            <s-stack gap="small-200">
              <s-link href={mail("Help with Employee Perks")} target="_blank">
                {SUPPORT_EMAIL}
              </s-link>
              <s-link href={WEBSITE} target="_blank">
                perks.tofoapp.com
              </s-link>
            </s-stack>
          </s-section>
        </s-stack>
      </s-box>
    </s-page>
  );
}

export function ErrorBoundary() {
  return <RouteError heading="Help" />;
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);
