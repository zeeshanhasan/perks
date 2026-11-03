import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { confirmVerification, getProgram } from "../lib/membership.server";
import { CONFIRM_MESSAGES, pages } from "../lib/proxy-page";
import { proxyContext } from "../lib/proxy-auth.server";
import { isWellFormedToken } from "../lib/tokens";

// Storefront: https://{shop}/apps/perks/confirm?token=...
// GET only renders a Confirm button (email link scanners must not consume tokens).
// POST consumes the token, bound to the signed logged-in customer.

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { liquid, shop, customerId } = await proxyContext(request);
  const token = new URL(request.url).searchParams.get("token") ?? "";
  const program = await getProgram(shop);
  if (!program.enabled) return liquid(pages.disabled());
  if (!isWellFormedToken(token)) return liquid(pages.failed(CONFIRM_MESSAGES.invalid));
  if (!customerId)
    return liquid(
      pages.loggedOut(program.employerName, `/apps/perks/confirm?token=${token}`, {
        kind: "info",
        text: "Log in with the account that requested this link, then open the link again.",
      }),
    );
  return liquid(pages.confirm(token));
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { liquid, shop, customerId, admin } = await proxyContext(request);
  const program = await getProgram(shop);
  if (!program.enabled) return liquid(pages.disabled());
  if (!customerId) return liquid(pages.loggedOut(program.employerName, "/apps/perks/verify"));
  if (!admin) return liquid(pages.failed(CONFIRM_MESSAGES.publish_failed, false));

  const form = await request.formData();
  const result = await confirmVerification({ admin, shop, customerId, token: form.get("token") });
  if (result.ok)
    return liquid(
      pages.verified(program.employerName, result.expiresAt, { kind: "ok", text: "Verified. Welcome aboard!" }),
    );
  if (result.reason === "revoked") return liquid(pages.revoked());
  return liquid(pages.failed(CONFIRM_MESSAGES[result.reason]));
};
