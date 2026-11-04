/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, expect, test } from "vitest";
import db from "../app/db.server";
import type { BusinessInput } from "../app/lib/business";
import { listBusinesses } from "../app/lib/business.server";
import { deleteBusiness, saveBusiness, saveSettings } from "../app/lib/settings.server";
import { EMPTY_TARGET } from "../app/lib/targeting";
import { fakeAdmin } from "./fake-admin";

const SHOP = "perks-settings.myshopify.com";
const DISCOUNT = "gid://shopify/DiscountAutomaticNode/1";
const VALIDATION = "gid://shopify/Validation/9";
const INSTALL = "gid://shopify/AppInstallation/7";

const tofo: BusinessInput = {
  name: "Tofo",
  domains: ["tofoapp.com"],
  discountType: "percentage",
  discountValue: 15,
  discountTarget: { ...EMPTY_TARGET, vendors: ["Solgar"], collections: [{ id: "gid://shopify/Collection/77", title: "Vitamins" }] },
  employeeOnlyTarget: { ...EMPTY_TARGET, products: [{ id: "gid://shopify/Product/1", title: "A" }], collections: [{ id: "gid://shopify/Collection/5", title: "Rx" }], types: ["Rx"] },
  limitPeriod: "month",
  limitBasis: "discount",
  limitAmount: 5000,
  billingEmail: "hr@tofoapp.com",
  billingAddress: "",
  active: true,
};
const google: BusinessInput = { ...tofo, name: "Google", domains: ["google.com"], discountType: "fixed", discountValue: 200, employeeOnlyTarget: EMPTY_TARGET, limitPeriod: "none", limitAmount: null };

beforeEach(async () => {
  for (const m of [db.business, db.benefitPolicy, db.employer, db.employeeMembership] as any[]) await m.deleteMany({ where: { shop: SHOP } });
  await db.benefitPolicy.create({ data: { shop: SHOP, enabled: true } });
});

test("saving businesses pushes one v2 config with every business to both Functions", async () => {
  const { admin, mf } = fakeAdmin();
  await saveBusiness(admin, SHOP, "merchant:t", tofo);
  await saveBusiness(admin, SHOP, "merchant:t", google);

  const cfg = mf(DISCOUNT, "perks_config");
  expect(cfg.v).toBe(2);
  expect(cfg.businesses.map((b: any) => [b.domains, b.type, b.value])).toEqual([
    [["tofoapp.com"], "percentage", 15],
    [["google.com"], "fixed", 200],
  ]);
  expect(cfg.businesses[0].target).toMatchObject({ vendors: ["solgar"], collectionIds: ["gid://shopify/Collection/77"] });
  expect(cfg.businesses[0].limit).toEqual({ period: "month", basis: "discount", amount: 5000 });
  expect(mf(DISCOUNT, "perks_vars")).toEqual({ collectionIds: ["gid://shopify/Collection/77", "gid://shopify/Collection/5"] });
  expect(mf(VALIDATION, "perks_config").businesses[0].employeeOnly.types).toEqual(["rx"]);
  expect(mf(VALIDATION, "perks_vars").collectionIds).toContain("gid://shopify/Collection/5");
});

test("employee-only targeting is resolved to products (flags + hashed handles for the theme)", async () => {
  const { admin, mf } = fakeAdmin();
  await saveBusiness(admin, SHOP, "merchant:t", tofo);
  // product 1 (picked), 50 (from collection 5), 60 (from type search)
  for (const id of [1, 50, 60]) expect(mf(`gid://shopify/Product/${id}`, "perks_employee_only")).toBe(true);
  const sf = mf(INSTALL, "storefront");
  expect(sf.businesses[0].employeeOnlyHandles.sort()).toEqual(["h-1", "h-50", "h-60"]);
  expect(sf.businesses[0].target.collectionIds).toEqual(["77"]);
  const policy = await db.benefitPolicy.findUniqueOrThrow({ where: { shop: SHOP } });
  expect(JSON.parse(policy.employeeOnlyProducts)).toHaveLength(3);
});

test("paused or deleted businesses drop out of the config; flags are removed", async () => {
  const { admin, mf, metafields } = fakeAdmin();
  const b = await saveBusiness(admin, SHOP, "merchant:t", tofo);
  await saveBusiness(admin, SHOP, "merchant:t", { ...tofo, active: false }, b.id);
  expect(mf(DISCOUNT, "perks_config").businesses).toEqual([]);
  expect(metafields.has("gid://shopify/Product/1|perks_employee_only")).toBe(false);
  await deleteBusiness(admin, SHOP, "merchant:t", b.id);
  // Archived, not removed: reports keep the name, and the legacy migration can't recreate it.
  expect(await db.business.count({ where: { shop: SHOP, archivedAt: null } })).toBe(0);
  expect(await db.business.count({ where: { shop: SHOP } })).toBe(1);
  expect(await listBusinesses(SHOP)).toHaveLength(0);
});

test("store-wide settings: exclusions reach the Functions", async () => {
  const { admin, mf } = fakeAdmin();
  await saveBusiness(admin, SHOP, "merchant:t", google);
  await saveSettings(admin, SHOP, "merchant:t", {
    enabled: true, autoDomain: false, eligibilityMonths: 6, combinesWithProduct: false, combinesWithOrder: true, combinesWithShipping: false,
    excludedProducts: ["gid://shopify/Product/9"],
  });
  expect(mf(DISCOUNT, "perks_config")).toMatchObject({ autoDomain: false, excluded: ["gid://shopify/Product/9"] });
});

test("legacy single-employer data migrates into one business", async () => {
  await db.employer.create({ data: { shop: SHOP, name: "Old Co", domains: '["old.com"]' } });
  await db.benefitPolicy.update({ where: { shop: SHOP }, data: { discountPercent: 12, employeeOnlyProducts: '["gid://shopify/Product/3"]', discountedProducts: '["gid://shopify/Product/4"]' } });
  await db.employeeMembership.create({ data: { shop: SHOP, customerId: "1", workEmail: "a@old.com", status: "active", verifiedAt: new Date() } });
  const [b] = await listBusinesses(SHOP);
  expect(b).toMatchObject({ name: "Old Co", domains: ["old.com"], discountValue: 12 });
  expect(b.employeeOnlyTarget.products.map((p) => p.id)).toEqual(["gid://shopify/Product/3"]);
  expect(b.discountTarget.products.map((p) => p.id)).toEqual(["gid://shopify/Product/4"]);
  expect((await db.employeeMembership.findFirstOrThrow({ where: { shop: SHOP } })).businessId).toBe(b.id);
  expect(await listBusinesses(SHOP)).toHaveLength(1); // idempotent
});
