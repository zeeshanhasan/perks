import db from "../db.server";
import type { AdminClient } from "./admin-graphql.server";
import { gql } from "./admin-graphql.server";
import { audit } from "./audit.server";
import { syncDiscountExcluded, syncDiscounted, syncEmployeeOnly } from "./metafields.server";
import type { SettingsInput } from "./policy";
import { parseJsonList } from "./policy";
import { ensureDiscount, ensureValidation, publishStorefrontConfig } from "./shopify-objects.server";

export async function getSettings(shop: string) {
  const [employer, policy] = await Promise.all([
    db.employer.findUnique({ where: { shop } }),
    db.benefitPolicy.findUnique({ where: { shop } }),
  ]);
  return {
    employer: employer ?? { shop, name: "", domains: "[]" },
    policy: policy ?? (await db.benefitPolicy.upsert({ where: { shop }, create: { shop }, update: {} })),
    configured: Boolean(employer?.name && parseJsonList(employer?.domains).length),
  };
}

export async function saveSettings(admin: AdminClient, shop: string, actor: string, input: SettingsInput) {
  await db.employer.upsert({
    where: { shop },
    create: { shop, name: input.employerName, domains: JSON.stringify(input.domains) },
    update: { name: input.employerName, domains: JSON.stringify(input.domains) },
  });
  await db.benefitPolicy.upsert({
    where: { shop },
    create: { shop, ...policyFields(input) },
    update: policyFields(input),
  });
  const policy = await syncShopifyObjects(admin, shop);
  await audit({
    shop,
    actor,
    action: "settings.update",
    result: "ok",
    detail: `discount=${input.discountPercent}% scope=${input.discountScope} autoDomain=${input.autoDomain} months=${input.eligibilityMonths ?? "none"} enabled=${input.enabled} domains=${input.domains.join(",")}`,
  });
  return policy;
}

function policyFields(i: SettingsInput) {
  return {
    discountPercent: i.discountPercent,
    eligibilityMonths: i.eligibilityMonths,
    discountScope: i.discountScope,
    autoDomain: i.autoDomain,
    combinesWithProduct: i.combinesWithProduct,
    combinesWithOrder: i.combinesWithOrder,
    combinesWithShipping: i.combinesWithShipping,
    enabled: i.enabled,
  };
}

/** Pushes the current policy to Shopify: discount, checkout rule and storefront config. */
export async function syncShopifyObjects(admin: AdminClient, shop: string) {
  const [policy, employer] = await Promise.all([
    db.benefitPolicy.findUniqueOrThrow({ where: { shop } }),
    db.employer.findUnique({ where: { shop } }),
  ]);
  const domains = parseJsonList(employer?.domains);
  const discountId = await ensureDiscount(admin, policy, domains);
  const validationId = await ensureValidation(admin, { ...policy, discountId }, domains);
  const updated = await db.benefitPolicy.update({ where: { shop }, data: { discountId, validationId } });
  await publishStorefrontConfig(admin, updated, domains);
  return updated;
}

async function handlesFor(admin: AdminClient, ids: string[]): Promise<string[]> {
  if (!ids.length) return [];
  const out: string[] = [];
  for (let i = 0; i < ids.length; i += 100) {
    const data = await gql<{ nodes: ({ handle?: string } | null)[] }>(
      admin,
      `#graphql
      query PerksProductHandles($ids: [ID!]!) { nodes(ids: $ids) { ... on Product { handle } } }`,
      { ids: ids.slice(i, i + 100) },
    );
    for (const n of data.nodes) if (n?.handle) out.push(n.handle);
  }
  return out;
}

export type ProductLists = { employeeOnly: string[]; discounted: string[]; excluded: string[] };

export async function saveProducts(admin: AdminClient, shop: string, actor: string, lists: ProductLists) {
  const { policy, configured } = await getSettings(shop);
  // A product can't be both employee-only and "open + discounted": employee-only wins.
  const discounted = lists.discounted.filter((id) => !lists.employeeOnly.includes(id));
  await syncEmployeeOnly(admin, parseJsonList(policy.employeeOnlyProducts), lists.employeeOnly);
  await syncDiscounted(admin, parseJsonList(policy.discountedProducts), discounted);
  await syncDiscountExcluded(admin, parseJsonList(policy.excludedProducts), lists.excluded);
  await db.benefitPolicy.update({
    where: { shop },
    data: {
      employeeOnlyProducts: JSON.stringify(lists.employeeOnly),
      discountedProducts: JSON.stringify(discounted),
      excludedProducts: JSON.stringify(lists.excluded),
      employeeOnlyHandles: JSON.stringify(await handlesFor(admin, lists.employeeOnly)),
    },
  });
  // Make sure the checkout rule + storefront config exist even if Settings was never saved.
  if (configured) await syncShopifyObjects(admin, shop);
  await audit({
    shop,
    actor,
    action: "products.update",
    result: "ok",
    detail: `employeeOnly=${lists.employeeOnly.length} discounted=${discounted.length} excluded=${lists.excluded.length}`,
  });
}
