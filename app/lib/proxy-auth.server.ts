import { authenticate } from "../shopify.server";

/**
 * Decision 002: identity comes ONLY from the HMAC-signed app proxy request.
 * `authenticate.public.appProxy` verifies the signature (throws 400/401 otherwise);
 * `logged_in_customer_id` is part of the signed query string.
 */
export async function proxyContext(request: Request) {
  const ctx = await authenticate.public.appProxy(request);
  const url = new URL(request.url);
  const shop = url.searchParams.get("shop") ?? "";
  const raw = url.searchParams.get("logged_in_customer_id") ?? "";
  const customerId = /^\d+$/.test(raw) ? raw : null;
  return { ...ctx, shop, customerId };
}
