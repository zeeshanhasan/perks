import type { AdminClient } from "./admin-graphql.server";
import { gql } from "./admin-graphql.server";

/** Vendors and product types in the store, for the targeting pickers. Best effort. */
export async function catalogFacets(admin: AdminClient): Promise<{ vendors: string[]; types: string[]; currency: string }> {
  try {
    const data = await gql<{
      shop: { currencyCode: string };
      productVendors: { edges: { node: string }[] };
      productTypes: { edges: { node: string }[] };
    }>(admin, `#graphql
      query PerksFacets {
        shop { currencyCode }
        productVendors(first: 250) { edges { node } }
        productTypes(first: 250) { edges { node } }
      }`);
    const clean = (xs: { node: string }[]) => [...new Set(xs.map((x) => x.node).filter(Boolean))].sort((a, b) => a.localeCompare(b));
    return { vendors: clean(data.productVendors.edges), types: clean(data.productTypes.edges), currency: data.shop.currencyCode };
  } catch (err) {
    console.warn("[perks] could not load vendors/types", err);
    try {
      const data = await gql<{ shop: { currencyCode: string } }>(admin, `#graphql
        query PerksCurrency { shop { currencyCode } }`);
      return { vendors: [], types: [], currency: data.shop.currencyCode };
    } catch {
      return { vendors: [], types: [], currency: "PKR" };
    }
  }
}

export type ShopInfo = { currency: string; name: string; timezone: string };

const SHOP_TTL = 10 * 60_000;
const shopCache = new Map<string, { at: number; info: ShopInfo }>();

/**
 * Currency, name and time zone, cached per shop for 10 minutes (one replica, decision 007) so pages
 * don't wait on this call every time. Failures aren't cached.
 */
export async function shopInfo(admin: AdminClient, shop: string): Promise<ShopInfo> {
  const hit = shopCache.get(shop);
  if (hit && Date.now() - hit.at < SHOP_TTL) return hit.info;
  try {
    const data = await gql<{ shop: { currencyCode: string; name: string; ianaTimezone: string } }>(admin, `#graphql
      query PerksShopZone { shop { currencyCode name ianaTimezone } }`);
    const info = { currency: data.shop.currencyCode, name: data.shop.name, timezone: data.shop.ianaTimezone || "UTC" };
    shopCache.set(shop, { at: Date.now(), info });
    return info;
  } catch {
    return { currency: "PKR", name: "", timezone: "UTC" };
  }
}

export async function shopCurrency(admin: AdminClient) {
  try {
    const data = await gql<{ shop: { currencyCode: string; name: string } }>(admin, `#graphql
      query PerksShopInfo { shop { currencyCode name } }`);
    return { currency: data.shop.currencyCode, name: data.shop.name };
  } catch {
    return { currency: "PKR", name: "" };
  }
}
