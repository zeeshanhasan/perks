import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { themeEditorEmbedUrl } from "../lib/setup.server";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  return {
    shop: session.shop,
    themeUrl: themeEditorEmbedUrl(session.shop, process.env.SHOPIFY_API_KEY || ""),
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

export default function Help() {
  const { shop, themeUrl } = useLoaderData<typeof loader>();
  return (
    <s-page heading="Help">
      <s-section heading="How it works">
        <s-ordered-list>
          <s-list-item>
            You add partner businesses on the Businesses page: each with its work email domains (for example{" "}
            <code>company.com</code>), its discount, its products and optional limits.
          </s-list-item>
          <s-list-item>
            An employee logs in to your store with their work email. Shopify sends them a login code, which proves the
            email is theirs.
          </s-list-item>
          <s-list-item>
            They automatically get the employee discount, and can buy employee-only products. No extra steps.
          </s-list-item>
          <s-list-item>
            Employees who shop with a personal email can verify their work email at{" "}
            <s-link href={`https://${shop}/apps/perks/verify`} target="_blank">
              /apps/perks/verify
            </s-link>
            . Add that link to your menu or use the &ldquo;Employee perks link&rdquo; theme block.
          </s-list-item>
        </s-ordered-list>
      </s-section>

      <s-section heading="Choosing products for a business">
        <s-unordered-list>
          <s-list-item>
            <strong>Discounted products:</strong> anyone can buy them; that business&apos;s employees get the discount.
            Pick all products, or any mix of products, collections, vendors and product types.
          </s-list-item>
          <s-list-item>
            <strong>Employee-only products:</strong> only that business&apos;s employees can buy them (also discounted).
            Everyone else is stopped at checkout.
          </s-list-item>
          <s-list-item>
            <strong>Never discounted</strong> (Settings): no employee discount on these, for any business.
          </s-list-item>
        </s-unordered-list>
      </s-section>

      <s-section heading="Limits, reports and invoices">
        <s-unordered-list>
          <s-list-item>
            <strong>Limits:</strong> cap each employee&apos;s discount or spend per month or per year. After the limit
            they pay full price until the next period. The order that crosses the limit still gets the discount.
          </s-list-item>
          <s-list-item>
            <strong>Reports:</strong> every employee order is recorded against their business. See orders, spend
            and discount for any week, month or date range.
          </s-list-item>
          <s-list-item>
            <strong>Invoices:</strong> bill a business for the discount its employees received, or for their total
            spend. Print or save as PDF, or download CSV. Issued invoices don&apos;t change afterwards.
          </s-list-item>
        </s-unordered-list>
      </s-section>

      <s-section heading="Turn on Employee mode in your theme">
        <s-stack gap="base">
          <s-paragraph>
            Employee mode shows employees their price on product pages and in collections, hides employee-only
            products from other shoppers, and replaces the buy button with a message on those products. Change its
            texts on the <s-link href="/app/storefront">Storefront</s-link> page.
          </s-paragraph>
          <s-ordered-list>
            <s-list-item>Open the theme editor with the button below.</s-list-item>
            <s-list-item>Make sure &ldquo;Employee mode&rdquo; is switched on under App embeds.</s-list-item>
            <s-list-item>Click Save.</s-list-item>
          </s-ordered-list>
          <s-box>
            <s-button href={themeUrl} target="_blank" icon="theme-edit">
              Open theme editor
            </s-button>
          </s-box>
        </s-stack>
      </s-section>

      <s-section heading="Questions">
        <s-stack gap="base">
          <Faq q="Can someone get the discount by typing a work email at checkout?">
            No. Perks only apply to customers who are logged in. Guest checkout never gets perks, whatever email is
            typed.
          </Faq>
          <Faq q="Can non-employees see employee-only products?">
            With Employee mode on, they&apos;re hidden from collections and search, and their product pages show a
            message instead of a buy button. Someone with a direct link can still view the page, but checkout always
            blocks them. Shopify only offers true per-customer catalogs on Shopify Plus.
          </Faq>
          <Faq q="Someone left the company. How do I remove their perks?">
            Go to Employees and click &ldquo;Remove perks&rdquo;. It works immediately, even if their email still
            matches your domain.
          </Faq>
          <Faq q="An employee says they don't get the discount.">
            Use <s-link href="/app/check">Check a customer</s-link>: type their email and you&apos;ll see exactly why,
            with the fix. Also check that the product is in that business&apos;s products.
          </Faq>
          <Faq q="Does the discount stack with other discounts?">
            Only if you allow it under Settings, &ldquo;Combining with other discounts&rdquo;. Otherwise Shopify applies
            the better discount.
          </Faq>
          <Faq q="Is it safe to uninstall?">
            Yes. Employee Perks never edits your theme code, so nothing is left behind. The storefront parts are theme
            app blocks that Shopify removes for you. Employee-only products become normal products again, so unpublish
            them first if they must stay private.
          </Faq>
          <Faq q="What happens if I uninstall?">
            The discount and checkout rule stop working straight away. Your app data is deleted 48 hours later, as
            Shopify requires.
          </Faq>
        </s-stack>
      </s-section>

      <s-section slot="aside" heading="Contact">
        <s-paragraph>
          Stuck? Email <s-link href="mailto:support@tofoapp.com">support@tofoapp.com</s-link> and we&apos;ll help.
        </s-paragraph>
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);
