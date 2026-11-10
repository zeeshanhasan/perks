import type { LoaderFunctionArgs } from "react-router";
import { describeDiscount } from "../lib/business";
import { listBusinesses } from "../lib/business.server";
import { shopCurrency } from "../lib/catalog.server";
import db from "../db.server";
import { pages, perksPage, publicAppliesTo } from "../lib/proxy-page";
import { proxyContext } from "../lib/proxy-auth.server";
import { parseStorefront } from "../lib/storefront";

// Storefront: GET https://{shop}/apps/perks — public list of partner companies and their discounts.
// Only shown when the merchant turns it on (Storefront page). Shows no customer data.

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { liquid, shop, customerId, admin } = await proxyContext(request);
  const policy = await db.benefitPolicy.findUnique({ where: { shop } });
  const options = parseStorefront(policy?.storefront);
  if (!policy?.enabled || !options.perksPage) return liquid(pages.disabled());

  let currency = "USD";
  if (admin) {
    try {
      currency = (await shopCurrency(admin)).currency;
    } catch {
      /* percentage discounts don't need it */
    }
  }
  const businesses = (await listBusinesses(shop)).filter((b) => b.active);
  return liquid(
    perksPage({
      title: options.perksPageTitle,
      intro: options.perksPageIntro,
      showDomains: options.perksPageDomains,
      loggedIn: Boolean(customerId),
      items: businesses.map((b) => ({
        name: b.name,
        discount: describeDiscount(b, currency),
        appliesTo: publicAppliesTo(b.discountTarget),
        domains: b.domains,
      })),
    }),
  );
};
