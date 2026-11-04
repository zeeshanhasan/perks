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

export async function shopCurrency(admin: AdminClient) {
  try {
    const data = await gql<{ shop: { currencyCode: string; name: string } }>(admin, `#graphql
      query PerksShopInfo { shop { currencyCode name } }`);
    return { currency: data.shop.currencyCode, name: data.shop.name };
  } catch {
    return { currency: "PKR", name: "" };
  }
}
