import db from "../db.server";
import { gql, type AdminClient } from "./admin-graphql.server";

// Store details every page needs (Shopify ID, name, currency, time zone, Shopify plan), fetched with
// one call and kept in memory (10 min) and in the database (6 h), so a restart or deploy doesn't make
// the next page wait on Shopify. If Shopify is slow or down, an older saved copy is used instead.

export type ShopDetails = { gid: string; name: string; currency: string; timezone: string; shopifyPlan: string };

const MEMORY_TTL = 10 * 60_000;
export const INFO_TTL = 6 * 60 * 60_000;
const memory = new Map<string, { at: number; d: ShopDetails }>();

export function clearShopMemory() {
  memory.clear();
}

function fromRow(r: { shopGid: string; name: string; currency: string; timezone: string; shopifyPlan: string }): ShopDetails {
  return { gid: r.shopGid, name: r.name, currency: r.currency, timezone: r.timezone, shopifyPlan: r.shopifyPlan };
}

async function fetchDetails(admin: AdminClient): Promise<ShopDetails> {
  const data = await gql<{
    shop: { id: string; name?: string; currencyCode?: string; ianaTimezone?: string; plan?: { publicDisplayName?: string } };
  }>(admin, `#graphql
    query PerksShopPlan { shop { id name currencyCode ianaTimezone plan { publicDisplayName partnerDevelopment } } }`);
  const s = data.shop;
  return {
    gid: s.id,
    name: s.name ?? "",
    currency: s.currencyCode ?? "",
    timezone: s.ianaTimezone || "UTC",
    shopifyPlan: s.plan?.publicDisplayName ?? "",
  };
}

/** Throws only when Shopify fails and nothing was ever saved for this store. */
export async function shopDetails(admin: AdminClient, shop: string, now = Date.now()): Promise<ShopDetails> {
  const m = memory.get(shop);
  if (m && now - m.at < MEMORY_TTL) return m.d;
  const row = await db.shopCache.findUnique({ where: { shop } });
  if (row && now - row.infoAt.getTime() < INFO_TTL) {
    const d = fromRow(row);
    memory.set(shop, { at: now, d });
    return d;
  }
  try {
    const d = await fetchDetails(admin);
    const data = { shopGid: d.gid, name: d.name, currency: d.currency, timezone: d.timezone, shopifyPlan: d.shopifyPlan, infoAt: new Date(now) };
    await db.shopCache.upsert({ where: { shop }, create: { shop, ...data }, update: data });
    memory.set(shop, { at: now, d });
    return d;
  } catch (err) {
    if (row) return fromRow(row); // Shopify hiccup: an older copy beats an error page
    throw err;
  }
}
