import db from "../db.server";
import type { AdminClient } from "./admin-graphql.server";
import { audit } from "./audit.server";
import { syncDiscountExcluded, syncEmployeeOnly } from "./metafields.server";
import type { SettingsInput } from "./policy";
import { parseJsonList } from "./policy";
import { ensureDiscount, ensureValidation } from "./shopify-objects.server";

export async function getSettings(shop: string) {
  const [employer, policy] = await Promise.all([
    db.employer.findUnique({ where: { shop } }),
    db.benefitPolicy.findUnique({ where: { shop } }),
  ]);
  return {
    employer: employer ?? { shop, name: "", domains: "[]" },
    policy:
      policy ??
      (await db.benefitPolicy.upsert({ where: { shop }, create: { shop }, update: {} })),
  };
}

export async function saveSettings(admin: AdminClient, shop: string, actor: string, input: SettingsInput) {
  await db.employer.upsert({
    where: { shop },
    create: { shop, name: input.employerName, domains: JSON.stringify(input.domains) },
    update: { name: input.employerName, domains: JSON.stringify(input.domains) },
  });
  let policy = await db.benefitPolicy.upsert({
    where: { shop },
    create: { shop, ...policyFields(input) },
    update: policyFields(input),
  });
  policy = await syncShopifyObjects(admin, shop);
  await audit({
    shop,
    actor,
    action: "settings.update",
    result: "ok",
    detail: `discount=${input.discountPercent}% scope=${input.discountScope} months=${input.eligibilityMonths ?? "none"} enabled=${input.enabled} domains=${input.domains.join(",")}`,
  });
  return policy;
}

function policyFields(i: SettingsInput) {
  return {
    discountPercent: i.discountPercent,
    eligibilityMonths: i.eligibilityMonths,
    discountScope: i.discountScope,
    combinesWithProduct: i.combinesWithProduct,
    combinesWithOrder: i.combinesWithOrder,
    combinesWithShipping: i.combinesWithShipping,
    enabled: i.enabled,
  };
}

/** Pushes the current policy to Shopify (discount + validation). */
export async function syncShopifyObjects(admin: AdminClient, shop: string) {
  const policy = await db.benefitPolicy.findUniqueOrThrow({ where: { shop } });
  const hasEmployeeOnly = parseJsonList(policy.employeeOnlyProducts).length > 0;
  const discountId = await ensureDiscount(admin, policy);
  const validationId = await ensureValidation(admin, { ...policy, discountId }, hasEmployeeOnly);
  return db.benefitPolicy.update({ where: { shop }, data: { discountId, validationId } });
}

export async function saveProducts(
  admin: AdminClient,
  shop: string,
  actor: string,
  employeeOnly: string[],
  excluded: string[],
) {
  const { policy } = await getSettings(shop);
  const prevOnly = parseJsonList(policy.employeeOnlyProducts);
  const prevExcluded = parseJsonList(policy.excludedProducts);
  // Write flags first; the DB records what's actually published.
  await syncEmployeeOnly(admin, prevOnly, employeeOnly);
  await syncDiscountExcluded(admin, prevExcluded, excluded);
  await db.benefitPolicy.update({
    where: { shop },
    data: { employeeOnlyProducts: JSON.stringify(employeeOnly), excludedProducts: JSON.stringify(excluded) },
  });
  // Validation enablement depends on whether employee-only products exist.
  const updated = await db.benefitPolicy.findUniqueOrThrow({ where: { shop } });
  const validationId = await ensureValidation(admin, updated, employeeOnly.length > 0);
  await db.benefitPolicy.update({ where: { shop }, data: { validationId } });
  await audit({
    shop,
    actor,
    action: "products.update",
    result: "ok",
    detail: `employeeOnly=${employeeOnly.length} excluded=${excluded.length}`,
  });
}
