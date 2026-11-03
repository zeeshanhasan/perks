import type { ActionFunctionArgs } from "react-router";
import { cancelOrder, recordOrder } from "../lib/usage.server";
import { authenticate } from "../shopify.server";

/** orders/create + orders/cancelled → usage tracking for reports, invoices and limits. */
export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic, payload, admin } = await authenticate.webhook(request);
  try {
    if (topic === "ORDERS_CREATE") await recordOrder(shop, payload, admin);
    else if (topic === "ORDERS_CANCELLED") await cancelOrder(shop, payload, admin);
  } catch (err) {
    console.error("[perks] orders webhook failed", topic, err);
    return new Response("error", { status: 500 }); // Shopify retries
  }
  return new Response();
};
