import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { gql } from "../lib/admin-graphql.server";
import { getMembership, getProgram, requestVerification } from "../lib/membership.server";
import { REQUEST_MESSAGES, pages } from "../lib/proxy-page";
import { proxyContext } from "../lib/proxy-auth.server";

// Storefront: GET/POST https://{shop}/apps/perks/verify

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { liquid, shop, customerId } = await proxyContext(request);
  const program = await getProgram(shop);
  if (!program.enabled) return liquid(pages.disabled());
  if (!customerId) return liquid(pages.loggedOut("/apps/perks/verify"));

  const m = await getMembership(shop, customerId);
  if (m?.status === "active") return liquid(pages.verified(program.employerName, m.expiresAt));
  const note =
    m?.status === "expired"
      ? { kind: "info" as const, text: "Your employee perks expired. Verify again to renew." }
      : m?.status === "revoked"
        ? { kind: "info" as const, text: "Your employee perks were removed. Contact the store if this is wrong." }
        : undefined;
  return liquid(pages.form(program.employerName, note));
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { liquid, shop, customerId, admin } = await proxyContext(request);
  const program = await getProgram(shop);
  if (!program.enabled) return liquid(pages.disabled());
  if (!customerId) return liquid(pages.loggedOut("/apps/perks/verify"));

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
  return liquid(
    pages.form(program.employerName, { kind: "error", text: REQUEST_MESSAGES[result.reason] }, rawEmail),
  );
};
