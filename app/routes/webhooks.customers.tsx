import type { ActionFunctionArgs } from "react-router";
import { recordDomainCustomer } from "../lib/membership.server";
import { authenticate } from "../shopify.server";

/**
 * customers/create + customers/update: keeps the Employees list in sync with customers whose
 * account email is at an approved domain. Eligibility itself is decided live by the Functions.
 */
export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, payload } = await authenticate.webhook(request);
  const p = payload as { id?: number | string; email?: string | null };
  if (p?.id != null) {
    try {
      await recordDomainCustomer(shop, String(p.id), p.email ?? null);
    } catch (err) {
      console.error("[perks] customers webhook failed", err);
      return new Response("error", { status: 500 });
    }
  }
  return new Response();
};
