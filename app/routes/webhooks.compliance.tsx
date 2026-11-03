import type { ActionFunctionArgs } from "react-router";
import { exportCustomerData, redactCustomer, redactShop } from "../lib/membership.server";
import { audit } from "../lib/audit.server";
import { authenticate } from "../shopify.server";

/**
 * Mandatory privacy webhooks (HMAC verified by authenticate.webhook).
 * customers/data_request: we log what we hold so the merchant can fulfil the request.
 * customers/redact: delete the customer's membership, challenges and work email.
 * shop/redact: delete everything for the shop (48h after uninstall).
 */
export const action = async ({ request }: ActionFunctionArgs) => {
  const { topic, shop, payload, admin } = await authenticate.webhook(request);
  const customerId = String((payload as { customer?: { id?: number | string } })?.customer?.id ?? "");

  switch (topic) {
    case "CUSTOMERS_DATA_REQUEST": {
      if (customerId) {
        const data = await exportCustomerData(shop, customerId);
        await audit({
          shop,
          actor: "system",
          action: "privacy.customer_data_request",
          subject: customerId,
          result: "ok",
          detail: `membership=${data.membership ? data.membership.status : "none"} requests=${data.verificationRequests.length}`,
        });
      }
      break;
    }
    case "CUSTOMERS_REDACT":
      if (customerId) await redactCustomer(shop, customerId, admin ?? undefined);
      break;
    case "SHOP_REDACT":
      await redactShop(shop);
      break;
    default:
      return new Response("Unhandled topic", { status: 400 });
  }
  return new Response();
};
