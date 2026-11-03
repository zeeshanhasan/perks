/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, test } from "vitest";
import { generateDiscounts, type DiscountInput } from "../extensions/perks-discount/src/logic";
import { BLOCK_MESSAGE, validateCart, type ValidationInput } from "../extensions/perks-validation/src/logic";

const today = "2026-11-02";
const T0 = { all: false, productIds: [], collectionIds: [], vendors: [], types: [] };
const COLL = "gid://shopify/Collection/77";
const config = (o: Record<string, unknown> = {}) => ({
  value: JSON.stringify({
    v: 2,
    autoDomain: true,
    excluded: ["gid://shopify/Product/9"],
    businesses: [
      { id: "tofo", domains: ["tofoapp.com"], type: "percentage", value: 15, target: { ...T0, vendors: ["solgar"] }, employeeOnly: { ...T0, productIds: ["gid://shopify/Product/1"] }, limit: null },
      { id: "goog", domains: ["google.com"], type: "fixed", value: 200, target: { ...T0, collectionIds: [COLL] }, employeeOnly: { ...T0, types: ["rx"] }, limit: { period: "month", basis: "discount", amount: 1000 } },
    ],
    ...o,
  }),
});

const line = (id: string, p: Record<string, any>) => ({ id: `gid://shopify/CartLine/${id}`, merchandise: { __typename: "ProductVariant", product: { id: `gid://shopify/Product/${id}`, ...p } } });
const tofoOnly = line("1", {}); // employee-only for Tofo
const solgar = line("2", { vendor: "Solgar" }); // discounted for Tofo (vendor)
const inColl = line("3", { inCollections: [{ collectionId: COLL, isMember: true }] }); // discounted for Google (collection)
const rx = line("4", { productType: "Rx" }); // employee-only for Google (type)
const plain = line("5", { vendor: "Other" });
const excludedSolgar = line("9", { vendor: "Solgar" });
const custom = { id: "gid://shopify/CartLine/c", merchandise: { __typename: "CustomProduct" } };

const who = (email: string | null, usage?: unknown) =>
  email === null ? null : { isAuthenticated: true, customer: { email, eligibility: null, usage: usage ? { value: JSON.stringify(usage) } : null } };

function dInput(lines: any[], buyer: any, cfg: any = config(), classes = ["PRODUCT"]): DiscountInput {
  return { cart: { buyerIdentity: buyer, lines }, shop: { localTime: { date: today } }, discount: { discountClasses: classes, config: cfg } };
}
const out = (o: ReturnType<typeof generateDiscounts>) => o.operations[0]?.productDiscountsAdd.candidates[0];
const targets = (o: ReturnType<typeof generateDiscounts>) => out(o)?.targets.map((t) => t.cartLine.id.split("/").pop()) ?? [];

describe("discount Function", () => {
  test("Tofo employee: 15% on vendor-targeted + their employee-only products", () => {
    const o = generateDiscounts(dInput([tofoOnly, solgar, inColl, rx, plain, custom], who("a@tofoapp.com")));
    expect(targets(o)).toEqual(["1", "2"]);
    expect(out(o)!.value).toEqual({ percentage: { value: 15 } });
  });
  test("Google employee: fixed Rs 200 off each item on collection + their employee-only", () => {
    const o = generateDiscounts(dInput([tofoOnly, solgar, inColl, rx, plain], who("a@google.com")));
    expect(targets(o)).toEqual(["3", "4"]);
    expect(out(o)!.value).toEqual({ fixedAmount: { amount: 200, appliesToEachItem: true } });
  });
  test("store-wide exclusions win", () => {
    expect(targets(generateDiscounts(dInput([excludedSolgar], who("a@tofoapp.com"))))).toEqual([]);
  });
  test("all-products targeting", () => {
    const c = JSON.parse(config().value);
    c.businesses[0].target.all = true;
    expect(targets(generateDiscounts(dInput([plain, rx, excludedSolgar], who("a@tofoapp.com"), { value: JSON.stringify(c) })))).toEqual(["5", "4"]);
  });
  test.each([["guest", null], ["normal customer", "me@gmail.com"]])("%s gets nothing", (_n, email) => {
    expect(generateDiscounts(dInput([tofoOnly, solgar, inColl], who(email))).operations).toEqual([]);
  });
  test("monthly discount limit: under → discount, reached → none", () => {
    const under = { v: 1, m: "2026-11", y: "2026", b: { goog: { md: 999, ms: 0, yd: 0, ys: 0 } } };
    const reached = { v: 1, m: "2026-11", y: "2026", b: { goog: { md: 1000, ms: 0, yd: 0, ys: 0 } } };
    const lastMonth = { v: 1, m: "2026-10", y: "2026", b: { goog: { md: 5000, ms: 0, yd: 0, ys: 0 } } };
    expect(targets(generateDiscounts(dInput([inColl], who("a@google.com", under))))).toEqual(["3"]);
    expect(generateDiscounts(dInput([inColl], who("a@google.com", reached))).operations).toEqual([]);
    expect(targets(generateDiscounts(dInput([inColl], who("a@google.com", lastMonth))))).toEqual(["3"]);
  });
  test("bad config or no PRODUCT class → nothing", () => {
    expect(generateDiscounts(dInput([solgar], who("a@tofoapp.com"), null)).operations).toEqual([]);
    expect(generateDiscounts(dInput([solgar], who("a@tofoapp.com"), { value: "{" })).operations).toEqual([]);
    expect(generateDiscounts(dInput([solgar], who("a@tofoapp.com"), config(), ["ORDER"])).operations).toEqual([]);
  });
});

function vInput(lines: any[], buyer: any, cfg: any = config()): ValidationInput {
  return { buyerJourney: { step: "CHECKOUT_COMPLETION" }, cart: { buyerIdentity: buyer, lines }, shop: { localTime: { date: today } }, validation: { config: cfg } };
}
const errs = (o: ReturnType<typeof validateCart>) => o.operations[0].validationAdd.errors;
const BLOCK = [{ message: BLOCK_MESSAGE, target: "$.cart" }];

describe("validation Function", () => {
  test("each business can buy its own employee-only products", () => {
    expect(errs(validateCart(vInput([tofoOnly, plain], who("a@tofoapp.com"))))).toEqual([]);
    expect(errs(validateCart(vInput([rx], who("a@google.com"))))).toEqual([]);
  });
  test("employees can't buy ANOTHER business's employee-only products", () => {
    expect(errs(validateCart(vInput([rx], who("a@tofoapp.com"))))).toEqual(BLOCK);
    expect(errs(validateCart(vInput([tofoOnly], who("a@google.com"))))).toEqual(BLOCK);
  });
  test.each([["guest", null], ["normal customer", "me@gmail.com"]])("%s is blocked from employee-only items", (_n, email) => {
    expect(errs(validateCart(vInput([plain, tofoOnly], who(email))))).toEqual(BLOCK);
  });
  test("discounted (open) and normal products are never blocked", () => {
    expect(errs(validateCart(vInput([solgar, inColl, plain, custom], who(null))))).toEqual([]);
  });
  test("synced product flag blocks even if live targeting missed (defence in depth)", () => {
    const flagged = line("8", { employeeOnly: { value: "true" } });
    expect(errs(validateCart(vInput([flagged], who("me@gmail.com"))))).toEqual(BLOCK);
    expect(errs(validateCart(vInput([flagged], who("a@google.com"))))).toEqual([]);
  });
  test("missing config: flagged products still blocked for everyone", () => {
    const flagged = line("8", { employeeOnly: { value: "true" } });
    expect(errs(validateCart(vInput([flagged], who("a@tofoapp.com"), null)))).toEqual(BLOCK);
  });
});
