import { expect, test } from "vitest";
import { parseProductIds, parseSettingsForm } from "../app/lib/policy";

function form(o: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(o)) f.set(k, v);
  return f;
}
const valid = { employerName: "Tofo", domains: "tofoapp.com", discountPercent: "15", eligibilityMonths: "12", discountScope: "selected" };

test("valid settings parse", () => {
  const r = parseSettingsForm(form({ ...valid, enabled: "on", combinesWithOrder: "on" }));
  expect(r.ok && r.value).toMatchObject({ discountPercent: 15, eligibilityMonths: 12, enabled: true, combinesWithOrder: true, combinesWithProduct: false });
});

test("legacy employee_only scope maps to selected; autoDomain parsed", () => {
  const r = parseSettingsForm(form({ ...valid, discountScope: "employee_only", autoDomain: "on" }));
  expect(r.ok && r.value).toMatchObject({ discountScope: "selected", autoDomain: true });
});

test("no expiry", () => {
  const r = parseSettingsForm(form({ ...valid, eligibilityMonths: "none" }));
  expect(r.ok && r.value.eligibilityMonths).toBeNull();
});

test.each([
  [{ discountPercent: "0" }, "discountPercent"],
  [{ discountPercent: "91" }, "discountPercent"],
  [{ discountPercent: "12.5" }, "discountPercent"],
  [{ eligibilityMonths: "25" }, "eligibilityMonths"],
  [{ domains: "" }, "domains"],
  [{ domains: "not a domain!" }, "domains"],
  [{ employerName: " " }, "employerName"],
  [{ discountScope: "everything" }, "discountScope"],
])("rejects %o", (patch, field) => {
  const r = parseSettingsForm(form({ ...valid, ...patch }));
  expect(r.ok).toBe(false);
  expect(!r.ok && r.errors[field]).toBeTruthy();
});

test("parseProductIds keeps only product GIDs", () => {
  expect(parseProductIds('["gid://shopify/Product/1","gid://shopify/Product/1","gid://shopify/Customer/2","x"]')).toEqual([
    "gid://shopify/Product/1",
  ]);
  expect(parseProductIds("not json")).toEqual([]);
});
