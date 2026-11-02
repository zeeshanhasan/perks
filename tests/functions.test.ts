/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, test } from "vitest";
import { generateDiscounts, type DiscountInput } from "../extensions/perks-discount/src/logic";
import { BLOCK_MESSAGE, validateCart, type ValidationInput } from "../extensions/perks-validation/src/logic";

const LINK_VERIFIED = { value: JSON.stringify({ v: 1, status: "active", expiresAt: "2027-11-02" }) };
const EXPIRED = { value: JSON.stringify({ v: 1, status: "active", expiresAt: "2026-11-01" }) };
const REVOKED = { value: JSON.stringify({ v: 1, status: "revoked" }) };
const T = { value: "true" };
const today = "2026-11-02";

const line = (id: string, p: Record<string, any>) => ({ id: `gid://shopify/CartLine/${id}`, merchandise: { __typename: "ProductVariant", product: p } });
const liquid = line("liquid", { employeeOnly: T }); // employee-only
const hydrogen = line("hydrogen", { employeeOnly: T, excluded: T }); // employee-only, never discounted
const vitaminC = line("vitc", { discounted: T }); // open to all, employees discounted
const green = line("green", {}); // normal
const custom = { id: "gid://shopify/CartLine/custom", merchandise: { __typename: "CustomProduct" } };

// Buyers
const employee = { isAuthenticated: true, customer: { email: "zeeshan@tofoapp.com", eligibility: null } };
const personalVerified = { isAuthenticated: true, customer: { email: "me@gmail.com", eligibility: LINK_VERIFIED } };
const normal = { isAuthenticated: true, customer: { email: "me@gmail.com", eligibility: null } };
const revokedEmployee = { isAuthenticated: true, customer: { email: "zeeshan@tofoapp.com", eligibility: REVOKED } };
const expired = { isAuthenticated: true, customer: { email: "me@gmail.com", eligibility: EXPIRED } };
const guest = null;

const cfg = (o: Record<string, any> = {}) => ({
  value: JSON.stringify({ v: 1, percent: 15, scope: "selected", domains: ["tofoapp.com"], autoDomain: true, ...o }),
});

function dInput(lines: any[], buyerIdentity: any, config: any = cfg(), classes = ["PRODUCT"]): DiscountInput {
  return {
    cart: { buyerIdentity, lines },
    shop: { localTime: { date: today } },
    discount: { discountClasses: classes, config },
  };
}
const targetsOf = (out: ReturnType<typeof generateDiscounts>) =>
  out.operations.flatMap((o) => o.productDiscountsAdd.candidates.flatMap((c) => c.targets.map((t) => t.cartLine.id)));

describe("discount Function", () => {
  test("employee (work-email login) gets 15% on employee-only + discounted products", () => {
    const out = generateDiscounts(dInput([liquid, vitaminC, green], employee));
    expect(targetsOf(out)).toEqual([liquid.id, vitaminC.id]);
    expect(out.operations[0].productDiscountsAdd.candidates[0].value.percentage.value).toBe(15);
  });
  test("employee shopping with personal email + link verification gets it too", () => {
    expect(targetsOf(generateDiscounts(dInput([liquid], personalVerified)))).toEqual([liquid.id]);
  });
  test("never-discounted list wins", () => {
    expect(targetsOf(generateDiscounts(dInput([hydrogen], employee)))).toEqual([]);
  });
  test("all_products scope discounts everything except exclusions", () => {
    expect(targetsOf(generateDiscounts(dInput([green, liquid, hydrogen, custom], employee, cfg({ scope: "all_products" }))))).toEqual([
      green.id,
      liquid.id,
    ]);
  });
  test("legacy employee_only scope behaves like selected", () => {
    expect(targetsOf(generateDiscounts(dInput([green, liquid], employee, cfg({ scope: "employee_only" }))))).toEqual([liquid.id]);
  });
  test.each([
    ["guest", guest],
    ["normal customer", normal],
    ["expired verification", expired],
    ["revoked employee", revokedEmployee],
  ])("%s gets no discount", (_n, b) => {
    expect(generateDiscounts(dInput([liquid, vitaminC], b)).operations).toEqual([]);
  });
  test("auto-domain off: work-email login alone gets nothing", () => {
    expect(generateDiscounts(dInput([liquid], employee, cfg({ autoDomain: false }))).operations).toEqual([]);
  });
  test.each([[null], [{ value: "{}" }], [cfg({ percent: 0 })], [cfg({ percent: 95 })], [cfg({ percent: 12.5 })]])(
    "bad config %o -> no discount",
    (c) => {
      expect(generateDiscounts(dInput([liquid], employee, c)).operations).toEqual([]);
    },
  );
  test("no PRODUCT class -> nothing", () => {
    expect(generateDiscounts(dInput([liquid], employee, cfg(), ["ORDER"])).operations).toEqual([]);
  });
});

const vcfg = (o: Record<string, any> = {}) => ({ config: { value: JSON.stringify({ v: 1, domains: ["tofoapp.com"], autoDomain: true, ...o }) } });
function vInput(lines: any[], buyerIdentity: any, validation: any = vcfg(), step: string | null = "CHECKOUT_COMPLETION"): ValidationInput {
  return { buyerJourney: { step }, cart: { buyerIdentity, lines }, shop: { localTime: { date: today } }, validation };
}
const errorsOf = (o: ReturnType<typeof validateCart>) => o.operations[0].validationAdd.errors;

describe("validation Function", () => {
  test("employee by work-email login can buy employee-only", () => {
    expect(errorsOf(validateCart(vInput([liquid, green], employee)))).toEqual([]);
  });
  test("link-verified employee can buy employee-only", () => {
    expect(errorsOf(validateCart(vInput([liquid], personalVerified)))).toEqual([]);
  });
  test.each([
    ["normal customer", normal],
    ["guest", guest],
    ["expired", expired],
    ["revoked employee", revokedEmployee],
  ])("%s is blocked from employee-only items", (_n, b) => {
    expect(errorsOf(validateCart(vInput([green, liquid], b)))).toEqual([{ message: BLOCK_MESSAGE, target: "$.cart" }]);
  });
  test("discounted (open) and normal products are never blocked", () => {
    expect(errorsOf(validateCart(vInput([green, vitaminC, custom], guest)))).toEqual([]);
  });
  test("missing validation config fails closed for domain path", () => {
    expect(errorsOf(validateCart(vInput([liquid], employee, null)))).toHaveLength(1);
    expect(errorsOf(validateCart(vInput([liquid], personalVerified, null)))).toEqual([]);
  });
  test("enforced at every journey step, including unknown", () => {
    for (const step of ["CART_INTERACTION", "CHECKOUT_INTERACTION", "CHECKOUT_COMPLETION", null])
      expect(errorsOf(validateCart(vInput([liquid], normal, vcfg(), step)))).toHaveLength(1);
  });
});
