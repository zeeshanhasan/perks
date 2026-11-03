/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, expect, test, vi } from "vitest";
import db from "../app/db.server";
import { saveProducts, saveSettings } from "../app/lib/settings.server";

const SHOP = "perks-settings.myshopify.com";

function fakeAdmin() {
  const calls: { op: string; vars: any }[] = [];
  const metafields: any[] = [];
  const admin = {
    graphql: vi.fn(async (query: string, opts?: { variables?: any }) => {
      const v = opts?.variables ?? {};
      const op = (query.match(/(?:query|mutation)\s+(\w+)/) ?? [])[1] ?? "?";
      calls.push({ op, vars: v });
      const ok = (data: any) => Response.json({ data });
      switch (op) {
        case "PerksFunctions":
          return ok({ shopifyFunctions: { nodes: [
            { id: "fn-d", apiType: "discount", title: "d" },
            { id: "fn-v", apiType: "cart_checkout_validation", title: "v" },
          ] } });
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
          metafields.push(...v.metafields);
          return ok({ metafieldsSet: { metafields: [], userErrors: [] } });
        case "PerksMetafieldsDelete":
          return ok({ metafieldsDelete: { deletedMetafields: [], userErrors: [] } });
        case "PerksProductHandles":
          return ok({ nodes: v.ids.map((id: string) => ({ handle: `h-${id.split("/").pop()}` })) });
        default:
          throw new Error(`unexpected ${op}`);
      }
    }),
  };
  return { admin, calls, metafields };
}

const settings = {
  employerName: "Tofo",
  domains: ["tofoapp.com"],
  discountPercent: 15,
  eligibilityMonths: 12,
  discountScope: "selected" as const,
  autoDomain: true,
  combinesWithProduct: false,
  combinesWithOrder: false,
  combinesWithShipping: false,
  enabled: true,
};

beforeEach(async () => {
  await db.benefitPolicy.deleteMany({ where: { shop: SHOP } });
  await db.employer.deleteMany({ where: { shop: SHOP } });
});

test("saving settings creates the discount, the checkout rule and the storefront config", async () => {
  const { admin, calls, metafields } = fakeAdmin();
  const policy = await saveSettings(admin, SHOP, "merchant:test", settings);
  expect(policy.discountId).toBe("gid://shopify/DiscountAutomaticNode/1");
  expect(policy.validationId).toBe("gid://shopify/Validation/9");
  expect(calls.map((c) => c.op)).toContain("PerksValidationCreate");

  const byOwner = (o: string) => JSON.parse(metafields.find((m) => m.ownerId === o).value);
  expect(byOwner("gid://shopify/DiscountAutomaticNode/1")).toEqual({
    v: 1, autoDomain: true, domains: ["tofoapp.com"], percent: 15, scope: "selected",
  });
  expect(byOwner("gid://shopify/Validation/9")).toEqual({ v: 1, autoDomain: true, domains: ["tofoapp.com"] });
  expect(byOwner("gid://shopify/AppInstallation/7")).toMatchObject({ v: 1, enabled: true, domains: ["tofoapp.com"], percent: 15 });
});

test("saving products flags products, keeps lists exclusive and publishes handles", async () => {
  const { admin, metafields } = fakeAdmin();
  await saveSettings(admin, SHOP, "merchant:test", settings);
  metafields.length = 0;
  await saveProducts(admin, SHOP, "merchant:test", {
    employeeOnly: ["gid://shopify/Product/1", "gid://shopify/Product/2"],
    discounted: ["gid://shopify/Product/2", "gid://shopify/Product/3"],
    excluded: ["gid://shopify/Product/2"],
  });
  const flags = metafields.filter((m) => m.ownerId.includes("/Product/")).map((m) => `${m.ownerId.split("/").pop()}:${m.key}`);
  expect(flags.sort()).toEqual(["1:perks_employee_only", "2:perks_discount_excluded", "2:perks_employee_only", "3:perks_discounted"]);
  const policy = await db.benefitPolicy.findUniqueOrThrow({ where: { shop: SHOP } });
  expect(JSON.parse(policy.discountedProducts)).toEqual(["gid://shopify/Product/3"]);
  const storefront = JSON.parse(metafields.find((m) => m.ownerId.includes("AppInstallation")).value);
  expect(storefront.employeeOnlyHandles).toEqual(["h-1", "h-2"]);
});
