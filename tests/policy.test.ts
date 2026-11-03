/* eslint-disable @typescript-eslint/no-explicit-any */
import { expect, test } from "vitest";
import { parseBusinessForm } from "../app/lib/business";
import { parseProductIds, parseSettingsForm } from "../app/lib/policy";
import { describeTarget, parseTargeting, productSearchQuery, toFunctionTarget } from "../app/lib/targeting";

function form(o: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(o)) f.set(k, v);
  return f;
}

test("settings form", () => {
  const r = parseSettingsForm(form({ enabled: "on", autoDomain: "on", eligibilityMonths: "none", excludedProducts: '["gid://shopify/Product/1","x"]' }));
  expect(r.ok && r.value).toEqual({
    enabled: true, autoDomain: true, eligibilityMonths: null, combinesWithProduct: false, combinesWithOrder: false, combinesWithShipping: false,
    excludedProducts: ["gid://shopify/Product/1"],
  });
  expect(parseSettingsForm(form({ eligibilityMonths: "25" })).ok).toBe(false);
});

const target = (o: Record<string, unknown>) => JSON.stringify({ all: false, products: [], collections: [], vendors: [], types: [], ...o });
const valid = {
  name: "Tofo", domains: "tofoapp.com, Tofo.PK", discountType: "percentage", discountValue: "15",
  discountTarget: target({ vendors: ["Solgar"] }), employeeOnlyTarget: target({}), limitPeriod: "none", active: "on",
};

test("business form: valid", () => {
  const r = parseBusinessForm(form(valid));
  expect(r.ok && r.value).toMatchObject({ name: "Tofo", domains: ["tofoapp.com", "tofo.pk"], discountValue: 15, limitAmount: null, active: true });
});

test("business form: fixed amount + monthly spend limit", () => {
  const r = parseBusinessForm(form({ ...valid, discountType: "fixed", discountValue: "199.999", limitPeriod: "month", limitBasis: "spend", limitAmount: "20000" }));
  expect(r.ok && r.value).toMatchObject({ discountType: "fixed", discountValue: 200, limitPeriod: "month", limitBasis: "spend", limitAmount: 20000 });
});

test.each([
  [{ name: "" }, "name"],
  [{ domains: "" }, "domains"],
  [{ domains: "not a domain!" }, "domains"],
  [{ discountValue: "0" }, "discountValue"],
  [{ discountValue: "91" }, "discountValue"],
  [{ discountValue: "12.5" }, "discountValue"],
  [{ discountType: "fixed", discountValue: "-5" }, "discountValue"],
  [{ discountTarget: target({}) }, "discountTarget"],
  [{ limitPeriod: "year", limitAmount: "0" }, "limitAmount"],
  [{ billingEmail: "nope" }, "billingEmail"],
])("business form rejects %o", (patch, field) => {
  const r = parseBusinessForm(form({ ...valid, ...(patch as Record<string, string>) }));
  expect(r.ok).toBe(false);
  expect(!r.ok && r.errors[field]).toBeTruthy();
});

test("employee-only targeting alone is enough, and can never be 'all products'", () => {
  const r = parseBusinessForm(form({ ...valid, discountTarget: target({}), employeeOnlyTarget: target({ all: true, types: ["Rx"] }) }));
  expect(r.ok && r.value.employeeOnlyTarget.all).toBe(false);
});

test("targeting parse is defensive and normalises for Functions", () => {
  const t = parseTargeting(target({ products: [{ id: "gid://shopify/Product/1", title: "A" }, "gid://shopify/Product/1", "bad"], collections: ["gid://shopify/Collection/2"], vendors: ["Solgar", "solgar", " "], types: ["Vitamins"] }));
  expect(t.products).toEqual([{ id: "gid://shopify/Product/1", title: "A" }]);
  expect(t.vendors).toEqual(["Solgar"]);
  expect(toFunctionTarget(t)).toEqual({ all: false, productIds: ["gid://shopify/Product/1"], collectionIds: ["gid://shopify/Collection/2"], vendors: ["solgar"], types: ["vitamins"] });
  expect(describeTarget(t)).toBe("1 product · 1 collection · vendor: Solgar · type: Vitamins");
  expect(productSearchQuery(t)).toBe('vendor:"Solgar" OR product_type:"Vitamins"');
  expect(parseTargeting("not json").products).toEqual([]);
});

test("parseProductIds keeps only product GIDs", () => {
  expect(parseProductIds('["gid://shopify/Product/1","gid://shopify/Product/1","gid://shopify/Customer/2"]')).toEqual(["gid://shopify/Product/1"]);
});
