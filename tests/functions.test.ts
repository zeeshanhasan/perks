/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, test } from "vitest";
import { generateDiscounts, type DiscountInput } from "../extensions/perks-discount/src/logic";
import { BLOCK_MESSAGE, validateCart, type ValidationInput } from "../extensions/perks-validation/src/logic";

const ELIGIBLE = { value: JSON.stringify({ v: 1, status: "active", expiresAt: "2027-11-02" }) };
const EXPIRED = { value: JSON.stringify({ v: 1, status: "active", expiresAt: "2026-11-01" }) };
const T = { value: "true" };
const today = "2026-11-02";

// Test catalog (docs/acceptance-tests.md)
const liquid = { id: "gid://shopify/CartLine/liquid", merchandise: { __typename: "ProductVariant", product: { employeeOnly: T, excluded: null } } };
const hydrogen = { id: "gid://shopify/CartLine/hydrogen", merchandise: { __typename: "ProductVariant", product: { employeeOnly: T, excluded: T } } };
const green = { id: "gid://shopify/CartLine/green", merchandise: { __typename: "ProductVariant", product: { employeeOnly: null, excluded: null } } };
const custom = { id: "gid://shopify/CartLine/custom", merchandise: { __typename: "CustomProduct" } };

const config = (percent: number, scope = "employee_only") => ({ value: JSON.stringify({ v: 1, percent, scope }) });

function dInput(lines: any[], eligibility: any, cfg = config(15), classes = ["PRODUCT"]): DiscountInput {
  return {
    cart: { buyerIdentity: eligibility === undefined ? null : { customer: { eligibility } }, lines },
    shop: { localTime: { date: today } },
    discount: { discountClasses: classes, config: cfg },
  };
}
const targetsOf = (out: ReturnType<typeof generateDiscounts>) =>
  out.operations.flatMap((o) => o.productDiscountsAdd.candidates.flatMap((c) => c.targets.map((t) => t.cartLine.id)));

describe("discount Function", () => {
  test("B1: eligible employee gets 15% on employee-only product", () => {
    const out = generateDiscounts(dInput([liquid], ELIGIBLE));
    expect(targetsOf(out)).toEqual([liquid.id]);
    expect(out.operations[0].productDiscountsAdd.candidates[0].value.percentage.value).toBe(15);
  });
  test("B2: excluded product gets nothing", () => {
    expect(targetsOf(generateDiscounts(dInput([hydrogen], ELIGIBLE)))).toEqual([]);
  });
  test("B3: normal product gets nothing (employee_only scope)", () => {
    expect(targetsOf(generateDiscounts(dInput([green, liquid], ELIGIBLE)))).toEqual([liquid.id]);
  });
  test("all_products scope still honours exclusions", () => {
    expect(targetsOf(generateDiscounts(dInput([green, liquid, hydrogen, custom], ELIGIBLE, config(10, "all_products"))))).toEqual([
      green.id,
      liquid.id,
    ]);
  });
  test.each([
    ["guest", undefined],
    ["no metafield", null],
    ["expired", EXPIRED],
    ["garbage", { value: "{" }],
  ])("B4: %s gets no discount", (_name, elig) => {
    expect(generateDiscounts(dInput([liquid], elig)).operations).toEqual([]);
  });
  test.each([[null], [{ value: "{}" }], [config(0)], [config(95)]])("bad config %o -> no discount", (cfg) => {
    expect(generateDiscounts(dInput([liquid], ELIGIBLE, cfg as any)).operations).toEqual([]);
  });
  test("no PRODUCT class -> nothing", () => {
    expect(generateDiscounts(dInput([liquid], ELIGIBLE, config(15), ["ORDER"])).operations).toEqual([]);
  });
});

function vInput(lines: any[], eligibility: any, step: string | null = "CHECKOUT_COMPLETION"): ValidationInput {
  return {
    buyerJourney: { step },
    cart: { buyerIdentity: eligibility === undefined ? null : { customer: { eligibility } }, lines },
    shop: { localTime: { date: today } },
  };
}
const errorsOf = (o: ReturnType<typeof validateCart>) => o.operations[0].validationAdd.errors;

describe("validation Function", () => {
  test("C4: eligible employee passes", () => {
    expect(errorsOf(validateCart(vInput([liquid, green], ELIGIBLE)))).toEqual([]);
  });
  test.each([
    ["C1 normal customer", null],
    ["C3 guest", undefined],
    ["expired", EXPIRED],
    ["revoked", { value: '{"v":1,"status":"revoked","expiresAt":null}' }],
  ])("%s is blocked from employee-only items", (_n, elig) => {
    expect(errorsOf(validateCart(vInput([green, liquid], elig)))).toEqual([{ message: BLOCK_MESSAGE, target: "$.cart" }]);
  });
  test("normal products are never blocked", () => {
    expect(errorsOf(validateCart(vInput([green, custom], undefined)))).toEqual([]);
  });
  test("enforced at every journey step, including unknown", () => {
    for (const step of ["CART_INTERACTION", "CHECKOUT_INTERACTION", "CHECKOUT_COMPLETION", null])
      expect(errorsOf(validateCart(vInput([liquid], null, step)))).toHaveLength(1);
  });
});
