import db from "../db.server";
import type { AdminClient } from "./admin-graphql.server";
import { gql } from "./admin-graphql.server";
import { audit } from "./audit.server";
import type { BusinessInput } from "./business";
import type { BusinessView } from "./business.server";
import { businessData, listBusinesses, migrateLegacy } from "./business.server";
import { syncEmployeeOnly } from "./metafields.server";
import type { SettingsInput } from "./policy";
import { parseJsonList } from "./policy";
import type { EmployeeOnlyIndex } from "./shopify-objects.server";
import { ensureDiscount, ensureValidation, publishStorefrontConfig } from "./shopify-objects.server";
import { productSearchQuery } from "./targeting";

export async function getSettings(shop: string) {
  await migrateLegacy(shop);
  const policy =
    (await db.benefitPolicy.findUnique({ where: { shop } })) ??
    (await db.benefitPolicy.upsert({ where: { shop }, create: { shop }, update: {} }));
  return { policy };
}

export async function saveSettings(admin: AdminClient, shop: string, actor: string, input: SettingsInput) {
  await getSettings(shop);
  await db.benefitPolicy.update({
    where: { shop },
    data: {
      enabled: input.enabled,
      autoDomain: input.autoDomain,
      eligibilityMonths: input.eligibilityMonths,
      combinesWithProduct: input.combinesWithProduct,
      combinesWithOrder: input.combinesWithOrder,
      combinesWithShipping: input.combinesWithShipping,
      excludedProducts: JSON.stringify(input.excludedProducts),
    },
  });
  const policy = await syncShopifyObjects(admin, shop);
  await audit({
    shop,
    actor,
    action: "settings.update",
    result: "ok",
    detail: `enabled=${input.enabled} autoDomain=${input.autoDomain} months=${input.eligibilityMonths ?? "none"} excluded=${input.excludedProducts.length}`,
  });
  return policy;
}

export async function saveBusiness(
  admin: AdminClient,
  shop: string,
  actor: string,
  input: BusinessInput,
  id?: string,
) {
  const data = businessData(input);
  const b = id
    ? await db.business.update({ where: { id, shop }, data })
    : await db.business.create({ data: { shop, ...data } });
  await syncShopifyObjects(admin, shop);
  await audit({
    shop,
    actor,
    action: id ? "business.update" : "business.create",
    subject: b.name,
    result: "ok",
    detail: `${input.discountType}=${input.discountValue} domains=${input.domains.join(",")} limit=${input.limitPeriod}`,
  });
  return b;
}

export async function deleteBusiness(admin: AdminClient, shop: string, actor: string, id: string) {
  const b = await db.business.findFirst({ where: { id, shop } });
  if (!b) return;
  await db.business.delete({ where: { id } });
  await db.employeeMembership.updateMany({ where: { shop, businessId: id, status: "active" }, data: { status: "inactive" } });
  await syncShopifyObjects(admin, shop);
  await audit({ shop, actor, action: "business.delete", subject: b.name, result: "ok" });
}

const MAX_RESOLVED = 5000;

type Page = { nodes: { id: string; handle: string }[]; pageInfo: { hasNextPage: boolean; endCursor: string | null } };

async function pageAll(fetchPage: (after: string | null) => Promise<Page>, out: Map<string, string>) {
  let after: string | null = null;
  for (let i = 0; i < 50 && out.size < MAX_RESOLVED; i++) {
    const p: Page = await fetchPage(after);
    for (const n of p.nodes) out.set(n.id, n.handle);
    if (!p.pageInfo.hasNextPage) break;
    after = p.pageInfo.endCursor;
  }
}

/**
 * Resolves each business's employee-only targeting to concrete products (id → handle).
 * Used for the theme embed (hiding) and the perks_employee_only product flag (defence in depth;
 * the Functions also evaluate targeting live at checkout).
 */
export async function resolveEmployeeOnly(admin: AdminClient, businesses: BusinessView[]) {
  const perBusiness: { businessId: string; products: Map<string, string> }[] = [];
  for (const b of businesses.filter((x) => x.active)) {
    const t = b.employeeOnlyTarget;
    const products = new Map<string, string>();
    if (t.products.length) {
      for (let i = 0; i < t.products.length; i += 100) {
        const data = await gql<{ nodes: ({ id: string; handle: string } | null)[] }>(admin, `#graphql
          query PerksHandles($ids: [ID!]!) { nodes(ids: $ids) { ... on Product { id handle } } }`, {
          ids: t.products.slice(i, i + 100).map((p) => p.id),
        });
        for (const n of data.nodes) if (n?.id) products.set(n.id, n.handle);
      }
    }
    for (const c of t.collections) {
      await pageAll(async (after) => {
        const data = await gql(admin, `#graphql
          query PerksCollectionProducts($id: ID!, $after: String) {
            collection(id: $id) { products(first: 250, after: $after) { nodes { id handle } pageInfo { hasNextPage endCursor } } }
          }`, { id: c.id, after });
        return data.collection?.products ?? { nodes: [], pageInfo: { hasNextPage: false, endCursor: null } };
      }, products);
    }
    const query = productSearchQuery(t);
    if (query) {
      await pageAll(async (after) => {
        const data = await gql(admin, `#graphql
          query PerksSearchProducts($q: String!, $after: String) {
            products(first: 250, after: $after, query: $q) { nodes { id handle } pageInfo { hasNextPage endCursor } }
          }`, { q: query, after });
        return data.products;
      }, products);
    }
    perBusiness.push({ businessId: b.id, products });
  }
  const allIds = [...new Set(perBusiness.flatMap((x) => [...x.products.keys()]))];
  const index: EmployeeOnlyIndex = perBusiness.map((x) => ({ businessId: x.businessId, handles: [...x.products.values()] }));
  return { allIds, index };
}

/** Pushes everything to Shopify: discount, checkout rule, product flags, storefront config. */
export async function syncShopifyObjects(admin: AdminClient, shop: string) {
  const { policy } = await getSettings(shop);
  const businesses = await listBusinesses(shop);
  const { allIds, index } = await resolveEmployeeOnly(admin, businesses);
  await syncEmployeeOnly(admin, parseJsonList(policy.employeeOnlyProducts), allIds);
  const discountId = await ensureDiscount(admin, policy, businesses);
  const validationId = await ensureValidation(admin, { ...policy, discountId }, businesses);
  const updated = await db.benefitPolicy.update({
    where: { shop },
    data: {
      discountId,
      validationId,
      employeeOnlyProducts: JSON.stringify(allIds),
      employeeOnlyHandles: JSON.stringify([...new Set(index.flatMap((x) => x.handles))]),
    },
  });
  await publishStorefrontConfig(admin, updated, businesses, index);
  return updated;
}
