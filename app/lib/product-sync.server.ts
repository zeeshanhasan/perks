import db from "../db.server";
import type { AdminClient } from "./admin-graphql.server";
import { syncShopifyObjects } from "./settings.server";

/** Waits this long after the last product change, so an import triggers one sync. */
export const QUIET_MS = 60_000;

/** Called by the products webhooks. Cheap: one row update, nothing sent to Shopify. */
export async function markProductsChanged(shop: string, now = new Date()) {
  await db.benefitPolicy.updateMany({ where: { shop }, data: { productsChangedAt: now } });
}

/** Stores whose products changed since their last sync and have been quiet for QUIET_MS. */
export async function shopsDueForProductSync(now = new Date()) {
  const rows = await db.benefitPolicy.findMany({
    // Only stores with the program set up (discountId) have storefront lists to refresh.
    where: { productsChangedAt: { not: null, lte: new Date(now.getTime() - QUIET_MS) }, discountId: { not: null } },
    select: { shop: true, productsChangedAt: true, productsSyncedAt: true },
  });
  return rows.filter((r) => !r.productsSyncedAt || r.productsSyncedAt < r.productsChangedAt!).map((r) => r.shop);
}

/**
 * Re-syncs stores whose products changed, so product cards show the employee price for imported or
 * edited products and newly matching employee-only products get hidden. Checkout never depended on
 * this: the Functions evaluate vendor/type/collection targeting live.
 */
export async function runProductSync(adminFor: (shop: string) => Promise<AdminClient>, now = new Date()) {
  const out: Record<string, string> = {};
  for (const shop of await shopsDueForProductSync(now)) {
    // Uninstalled stores have no session: nothing to sync.
    if (!(await db.session.findFirst({ where: { shop, isOnline: false }, select: { id: true } }))) continue;
    try {
      await syncShopifyObjects(await adminFor(shop), shop);
      out[shop] = "synced";
    } catch (err) {
      console.error("[perks] product sync failed", shop, err);
      out[shop] = "error";
    }
    // Marked either way, so a failing store isn't retried every minute; the next product change tries again.
    await db.benefitPolicy.update({ where: { shop }, data: { productsSyncedAt: now } });
  }
  return out;
}
