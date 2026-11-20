import type { ActionFunctionArgs } from "react-router";
import { markProductsChanged } from "../lib/product-sync.server";
import { authenticate } from "../shopify.server";

/**
 * products/create + update + delete: only records that products changed. The scheduler re-syncs once
 * things are quiet, so an import of hundreds of products causes one sync, not hundreds.
 */
export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop } = await authenticate.webhook(request);
  try {
    await markProductsChanged(shop);
  } catch (err) {
    console.error("[perks] products webhook failed", err);
    return new Response("error", { status: 500 });
  }
  return new Response();
};
