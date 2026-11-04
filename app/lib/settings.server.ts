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
import { type DiscountedIndex, type EmployeeOnlyIndex, ensureDiscount, ensureValidation, publishStorefrontConfig } from "./shopify-objects.server";
import { productSearchQuery } from "./targeting";
import type { Targeting } from "./targeting";

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
  const syncError = await trySync(admin, shop);
  await audit({
    shop,
    actor,
    action: id ? "business.update" : "business.create",
    subject: b.name,
    result: "ok",
    detail: `${input.discountType}=${input.discountValue} domains=${input.domains.join(",")} limit=${input.limitPeriod}`,
  });
  return Object.assign(b, { syncError });
}

/**
 * Saves are recorded first, then pushed to Shopify. If the push fails, the change is kept and the
 * error is returned (and retried on the next save), instead of failing the whole request.
 */
async function trySync(admin: AdminClient, shop: string): Promise<string | null> {
  try {
    await syncShopifyObjects(admin, shop);
    return null;
  } catch (err) {
    console.error("[perks] sync to Shopify failed", err);
    const msg = err instanceof Error ? err.message : String(err);
    await audit({ shop, actor: "system", action: "shopify.sync", result: "error", detail: msg.slice(0, 200) });
    return msg;
  }
}

/**
 * "Delete" archives the business: perks stop at once, but its orders, reports and invoices keep
 * its name. Hard deletes would also let the legacy migration recreate a business.
 */
export async function deleteBusiness(admin: AdminClient, shop: string, actor: string, id: string) {
  const b = await db.business.findFirst({ where: { id, shop, archivedAt: null } });
  if (!b) return;
  await db.business.update({ where: { id }, data: { archivedAt: new Date(), active: false } });
  await db.employeeMembership.updateMany({ where: { shop, businessId: id, status: "active" }, data: { status: "inactive" } });
  const syncError = await trySync(admin, shop);
  await audit({ shop, actor, action: "business.delete", subject: b.name, result: "ok" });
  return { syncError };
}

/** Pause or resume a business from the list. */
export async function setBusinessActive(admin: AdminClient, shop: string, actor: string, id: string, active: boolean) {
  const b = await db.business.findFirst({ where: { id, shop, archivedAt: null } });
  if (!b || b.active === active) return b;
  const u = await db.business.update({ where: { id }, data: { active } });
  const syncError = await trySync(admin, shop);
  if (syncError) throw new Error(syncError);
  await audit({ shop, actor, action: active ? "business.resume" : "business.pause", subject: b.name, result: "ok" });
  return u;
}

/** What deleting a business affects, shown before the merchant confirms. */
export async function deleteImpact(shop: string, id: string) {
  const [employees, orders] = await Promise.all([
    db.employeeMembership.count({ where: { shop, businessId: id, status: "active" } }),
    db.orderUsage.count({ where: { shop, businessId: id, cancelled: false } }),
  ]);
  return { employees, orders };
}

const MAX_RESOLVED = 5000;
/** Keeps the storefront config small enough for the theme to load quickly. */
const MAX_STOREFRONT_HANDLES = 2000;

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
/** Resolves targeting to concrete products (id → handle), up to MAX_RESOLVED. */
async function resolveTarget(admin: AdminClient, t: Targeting) {
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
  return products;
}

/**
 * Resolves each business's employee-only targeting to concrete products (id → handle).
 * Used for the theme embed (hiding) and the perks_employee_only product flag (defence in depth;
 * the Functions also evaluate targeting live at checkout).
 */
export async function resolveEmployeeOnly(admin: AdminClient, businesses: BusinessView[]) {
  const perBusiness: { businessId: string; products: Map<string, string> }[] = [];
  for (const b of businesses.filter((x) => x.active)) {
    perBusiness.push({ businessId: b.id, products: await resolveTarget(admin, b.employeeOnlyTarget) });
  }
  const allIds = [...new Set(perBusiness.flatMap((x) => [...x.products.keys()]))];
  const index: EmployeeOnlyIndex = perBusiness.map((x) => ({ businessId: x.businessId, handles: [...x.products.values()] }));
  return { allIds, index };
}

/**
 * Handles of each business's discounted products, for showing the employee price on collection
 * cards. Not needed when a business discounts everything.
 */
export async function resolveDiscounted(admin: AdminClient, businesses: BusinessView[]): Promise<DiscountedIndex> {
  const out: DiscountedIndex = [];
  for (const b of businesses.filter((x) => x.active && !x.discountTarget.all)) {
    const products = await resolveTarget(admin, b.discountTarget);
    out.push({ businessId: b.id, handles: [...products.values()].slice(0, MAX_STOREFRONT_HANDLES) });
  }
  return out;
}

/** Pushes everything to Shopify: discount, checkout rule, product flags, storefront config. */
export async function syncShopifyObjects(admin: AdminClient, shop: string) {
  const { policy } = await getSettings(shop);
  const businesses = await listBusinesses(shop);
  const { allIds, index } = await resolveEmployeeOnly(admin, businesses);
  await syncEmployeeOnly(admin, parseJsonList(policy.employeeOnlyProducts), allIds);
  const discountId = await ensureDiscount(admin, policy, businesses);
  // Save the id right away, so a later failure can't make the next save create a duplicate.
  if (discountId !== policy.discountId) await db.benefitPolicy.update({ where: { shop }, data: { discountId } });
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
  const discounted = await resolveDiscounted(admin, businesses);
  await publishStorefrontConfig(admin, updated, businesses, index, discounted);
  return updated;
}
