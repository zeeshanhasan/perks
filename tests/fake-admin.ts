/* eslint-disable @typescript-eslint/no-explicit-any */
import { vi } from "vitest";

/** Fake Admin API for server tests. Records calls and metafield writes. */
export function fakeAdmin(overrides: Record<string, (vars: any) => any> = {}) {
  const calls: { op: string; vars: any }[] = [];
  const metafields = new Map<string, any>(); // `${ownerId}|${key}` -> value
  const admin = {
    graphql: vi.fn(async (query: string, opts?: { variables?: any }) => {
      const v = opts?.variables ?? {};
      const op = (query.match(/(?:query|mutation)\s+(\w+)/) ?? [])[1] ?? "?";
      calls.push({ op, vars: v });
      const ok = (data: any) => Response.json({ data });
      if (overrides[op]) return ok(overrides[op](v));
      switch (op) {
        case "PerksFunctions":
          return ok({ shopifyFunctions: { nodes: [{ id: "fn-d", apiType: "discount", title: "d" }, { id: "fn-v", apiType: "cart_checkout_validation", title: "v" }] } });
        case "PerksDiscountCreate":
          return ok({ discountAutomaticAppCreate: { automaticAppDiscount: { discountId: "gid://shopify/DiscountAutomaticNode/1" }, userErrors: [] } });
        case "PerksDiscountNode":
          return ok({ discountNode: { id: v.id } });
        case "PerksDiscountUpdate":
          return ok({ discountAutomaticAppUpdate: { automaticAppDiscount: { discountId: v.id }, userErrors: [] } });
        case "PerksDiscountToggle":
          return ok({ discountAutomaticActivate: { userErrors: [] }, discountAutomaticDeactivate: { userErrors: [] } });
        case "PerksValidationCreate":
          return ok({ validationCreate: { validation: { id: "gid://shopify/Validation/9" }, userErrors: [] } });
        case "PerksValidationUpdate":
          return ok({ validationUpdate: { validation: { id: v.id }, userErrors: [] } });
        case "PerksInstallation":
          return ok({ currentAppInstallation: { id: "gid://shopify/AppInstallation/7" } });
        case "PerksMetafieldsSet":
          for (const m of v.metafields) metafields.set(`${m.ownerId}|${m.key}`, m.value);
          return ok({ metafieldsSet: { metafields: [], userErrors: [] } });
        case "PerksMetafieldsDelete":
          for (const m of v.metafields) metafields.delete(`${m.ownerId}|${m.key}`);
          return ok({ metafieldsDelete: { deletedMetafields: [], userErrors: [] } });
        case "PerksHandles":
          return ok({ nodes: v.ids.map((id: string) => ({ id, handle: `h-${id.split("/").pop()}` })) });
        case "PerksCollectionProducts":
          return ok({ collection: { products: { nodes: [{ id: "gid://shopify/Product/50", handle: "h-50" }], pageInfo: { hasNextPage: false, endCursor: null } } } });
        case "PerksSearchProducts":
          return ok({ products: { nodes: [{ id: "gid://shopify/Product/60", handle: "h-60" }], pageInfo: { hasNextPage: false, endCursor: null } } });
        default:
          throw new Error(`unexpected ${op}`);
      }
    }),
  };
  const mf = (owner: string, key: string) => {
    const raw = metafields.get(`${owner}|${key}`);
    return raw === undefined ? undefined : JSON.parse(raw);
  };
  return { admin, calls, metafields, mf };
}
