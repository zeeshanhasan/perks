import { gql } from "./admin-graphql.server";

export type ShopDetails = { name: string; email: string; address: string[] };

/** The store's name, email and address for the "From" block. Falls back to the shop domain. */
export async function shopDetails(admin: Parameters<typeof gql>[0], shop: string): Promise<ShopDetails> {
  try {
    const data = await gql<{
      shop: {
        name: string;
        email: string;
        shopAddress: { address1: string | null; address2: string | null; city: string | null; province: string | null; zip: string | null; country: string | null } | null;
      };
    }>(admin, `#graphql
      query PerksInvoiceShop {
        shop {
          name
          email
          shopAddress { address1 address2 city province zip country }
        }
      }`);
    const a = data.shop.shopAddress;
    const address = a
      ? [a.address1, a.address2, [a.city, a.province, a.zip].filter(Boolean).join(", "), a.country].filter((x): x is string => Boolean(x))
      : [];
    return { name: data.shop.name || shop, email: data.shop.email, address };
  } catch {
    return { name: shop, email: "", address: [] };
  }
}
