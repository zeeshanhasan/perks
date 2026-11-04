import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { gql } from "../lib/admin-graphql.server";
import {
  getCustomerEmail,
  getMembership,
  businessOf,
  getProgram,
  isDomainEligible,
  recordDomainCustomer,
  requestVerification,
} from "../lib/membership.server";
import { REQUEST_MESSAGES, pages } from "../lib/proxy-page";
import { proxyContext } from "../lib/proxy-auth.server";

// Storefront: GET/POST https://{shop}/apps/perks/verify

const RETURN = "/apps/perks/verify";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { liquid, shop, customerId, admin } = await proxyContext(request);
  const program = await getProgram(shop);
  if (!program.enabled) return liquid(pages.disabled());
  if (!customerId) return liquid(pages.loggedOut(program.employerName, RETURN));

  const m = await getMembership(shop, customerId);
  if (m?.status === "revoked") return liquid(pages.revoked());
  if (m?.status === "active" && m.source === "link")
    return liquid(pages.verified(program.businesses.find((b) => b.id === m.businessId)?.name ?? program.employerName, m.expiresAt));

  if (admin) {
    const email = await getCustomerEmail(admin, customerId);
    if (isDomainEligible(program, email)) {
      await recordDomainCustomer(shop, customerId, email);
      return liquid(pages.autoEligible(businessOf(program, email)?.name ?? program.employerName));
    }
  }
  const note =
    m?.status === "expired" ? { kind: "info" as const, text: "Your employee perks expired. Verify again to renew." } : undefined;
  return liquid(pages.form(program.employerName, note));
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { liquid, shop, customerId, admin } = await proxyContext(request);
  const program = await getProgram(shop);
  if (!program.enabled) return liquid(pages.disabled());
  if (!customerId) return liquid(pages.loggedOut(program.employerName, RETURN));

  const form = await request.formData();
  const rawEmail = String(form.get("email") ?? "").slice(0, 320);

  let shopName = shop;
  if (admin) {
    try {
      shopName = (await gql(admin, `#graphql
        query PerksShopName { shop { name } }`)).shop.name;
    } catch {
      /* fall back to domain */
    }
  }

  const result = await requestVerification({
    shop,
    customerId,
    rawEmail,
    storefrontOrigin: `https://${shop}`,
    shopName,
  });
  if (result.ok) return liquid(pages.sent());
  if (result.reason === "revoked") return liquid(pages.revoked());
  return liquid(pages.form(program.employerName, { kind: "error", text: REQUEST_MESSAGES[result.reason] }, rawEmail));
};
