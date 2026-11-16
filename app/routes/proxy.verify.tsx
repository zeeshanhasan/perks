import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { emailDomain } from "../lib/domain";
import {
  getCustomerEmail,
  getMembership,
  businessOf,
  getProgram,
  isDomainEligible,
  recordDomainCustomer,
} from "../lib/membership.server";
import { pages } from "../lib/proxy-page";
import { proxyContext } from "../lib/proxy-auth.server";

// Storefront: https://{shop}/apps/perks/verify, the shopper's "my perks" status page.
// Decision 016: employees qualify only by logging in with a work email; there's no form and no email.

const RETURN = "/apps/perks/verify";

async function statusPage(request: Request) {
  const { liquid, shop, customerId, admin } = await proxyContext(request);
  const program = await getProgram(shop);
  if (!program.enabled) return liquid(pages.disabled());
  if (!customerId) return liquid(pages.loggedOut(program.employerName, RETURN));

  const m = await getMembership(shop, customerId);
  if (m?.status === "revoked") return liquid(pages.revoked());
  // Verified by email link before decision 016: still valid until its date.
  if (m?.status === "active" && m.source === "link" && (!m.expiresAt || m.expiresAt.getTime() > Date.now()))
    return liquid(pages.verified(program.businesses.find((b) => b.id === m.businessId)?.name ?? program.employerName, m.expiresAt));

  const email = admin ? await getCustomerEmail(admin, customerId) : null;
  if (isDomainEligible(program, email)) {
    await recordDomainCustomer(shop, customerId, email);
    return liquid(pages.autoEligible(businessOf(program, email)?.name ?? program.employerName));
  }
  return liquid(pages.notEligible(email ? emailDomain(email) : null));
}

export const loader = async ({ request }: LoaderFunctionArgs) => statusPage(request);
// Old forms posted here: show the same status page.
export const action = async ({ request }: ActionFunctionArgs) => statusPage(request);
