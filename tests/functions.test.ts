/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, test } from "vitest";
import { generateDiscounts, type DiscountInput } from "../extensions/perks-discount/src/logic";
import { BLOCK_MESSAGE, REMOVED_MESSAGE, validateCart, type ValidationInput } from "../extensions/perks-validation/src/logic";

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
const inColl = { ...line("3", { inCollections: [{ collectionId: COLL, isMember: true }] }), quantity: 1, cost: { subtotalAmount: { amount: "500.0" } } }; // discounted for Google (collection)
const rx = { ...line("4", { productType: "Rx" }), quantity: 1, cost: { subtotalAmount: { amount: "300.0" } } }; // employee-only for Google (type)
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
  test("limit: a line without a price gets nothing (fail closed)", () => {
    const under = { v: 1, m: "2026-11", y: "2026", b: { goog: { md: 0, ms: 0, yd: 0, ys: 0 } } };
    const noCost = line("3", { inCollections: [{ collectionId: COLL, isMember: true }] });
    expect(generateDiscounts(dInput([noCost], who("a@google.com", under))).operations).toEqual([]);
  });
  test("bad config or no PRODUCT class → nothing", () => {
    expect(generateDiscounts(dInput([solgar], who("a@tofoapp.com"), null)).operations).toEqual([]);
    expect(generateDiscounts(dInput([solgar], who("a@tofoapp.com"), { value: "{" })).operations).toEqual([]);
    expect(generateDiscounts(dInput([solgar], who("a@tofoapp.com"), config(), ["ORDER"])).operations).toEqual([]);
  });
});

// The boss's example: 10% off, a monthly limit, three items. The discount stops exactly at the limit.
describe("discount Function: limits give what's left, then stop", () => {
  const priced = (id: string, amount: number, quantity = 1) => ({
    ...line(id, { vendor: "Solgar" }),
    quantity,
    cost: { subtotalAmount: { amount: String(amount) } },
  });
  const withLimit = (limit: Record<string, unknown>, type = "percentage", value = 10) => {
    const c = JSON.parse(config().value);
    Object.assign(c.businesses[0], { type, value, limit });
    return { value: JSON.stringify(c) };
  };
  const usage = (o: Record<string, number>) => ({ v: 1, m: "2026-11", y: "2026", b: { tofo: { md: 0, ms: 0, yd: 0, ys: 0, ...o } } });
  const run = (lines: any[], cfg: any, u: any) => generateDiscounts(dInput(lines, who("a@tofoapp.com", u), cfg));
  const cands = (o: ReturnType<typeof generateDiscounts>) =>
    o.operations[0]?.productDiscountsAdd.candidates.map((c) => ({ ids: c.targets.map((t) => t.cartLine.id.split("/").pop()), value: c.value })) ?? [];

  test("discount limit: full 10% on the first items, the rest of the limit on the next, nothing after", () => {
    // Limit 500 of discount, 0 used. Items 2000 + 2500 → 450 off; item 3 (2000) would be 200 → only 50 left.
    const o = run([priced("1", 2000), priced("2", 2500), priced("3", 2000), priced("4", 1000)], withLimit({ period: "month", basis: "discount", amount: 500 }), usage({}));
    expect(o.operations[0].productDiscountsAdd.selectionStrategy).toBe("ALL");
    expect(cands(o)).toEqual([
      { ids: ["1", "2"], value: { percentage: { value: 10 } } },
      { ids: ["3"], value: { fixedAmount: { amount: 50, appliesToEachItem: false } } },
    ]);
  });
  test("discount limit counts what was already used this month", () => {
    const o = run([priced("1", 2000)], withLimit({ period: "month", basis: "discount", amount: 500 }), usage({ md: 470 }));
    expect(cands(o)).toEqual([{ ids: ["1"], value: { fixedAmount: { amount: 30, appliesToEachItem: false } } }]);
  });
  test("spend limit: discount only on the part of the cart that fits", () => {
    // Spend limit 5000, 0 used. Item 1: 3000 → pays 2700. 2300 left; item 2 (3000, 10%) → discount on
    // 2300/0.9 = 2555.56 of it = 255.55.
    const o = run([priced("1", 3000), priced("2", 3000)], withLimit({ period: "month", basis: "spend", amount: 5000 }), usage({}));
    expect(cands(o)).toEqual([
      { ids: ["1"], value: { percentage: { value: 10 } } },
      { ids: ["2"], value: { fixedAmount: { amount: 255.55, appliesToEachItem: false } } },
    ]);
  });
  test("a cart that fits in the limit gets the normal discount", () => {
    const o = run([priced("1", 1000), priced("2", 1000)], withLimit({ period: "month", basis: "discount", amount: 500 }), usage({}));
    expect(o.operations[0].productDiscountsAdd.selectionStrategy).toBe("FIRST");
    expect(cands(o)).toEqual([{ ids: ["1", "2"], value: { percentage: { value: 10 } } }]);
  });
  test("fixed amount per item counts every unit, and never more than the price", () => {
    // 200 off each unit, 3 units of 1000 → 600; limit 500 → 500 on that line.
    const o = run([priced("1", 3000, 3)], withLimit({ period: "month", basis: "discount", amount: 500 }, "fixed", 200), usage({}));
    expect(cands(o)).toEqual([{ ids: ["1"], value: { fixedAmount: { amount: 500, appliesToEachItem: false } } }]);
  });
  test("'only items that fit in full': the item that would go past the limit is full price", () => {
    const o = run(
      [priced("1", 2000), priced("2", 2500), priced("3", 2000)],
      withLimit({ period: "month", basis: "discount", amount: 500, overflow: "whole" }),
      usage({}),
    );
    expect(cands(o)).toEqual([{ ids: ["1", "2"], value: { percentage: { value: 10 } } }]);
    const none = run([priced("1", 6000)], withLimit({ period: "month", basis: "discount", amount: 500, overflow: "whole" }), usage({}));
    expect(none.operations).toEqual([]);
  });
  test("limit reached → nothing", () => {
    expect(run([priced("1", 1000)], withLimit({ period: "month", basis: "discount", amount: 500 }), usage({ md: 500 })).operations).toEqual([]);
  });
  test("limit is converted to the cart's currency", () => {
    const c = withLimit({ period: "month", basis: "discount", amount: 500 });
    const input = { ...dInput([priced("1", 20000)], who("a@tofoapp.com", usage({})), c), presentmentCurrencyRate: "0.5" };
    expect(cands(generateDiscounts(input))).toEqual([{ ids: ["1"], value: { fixedAmount: { amount: 250, appliesToEachItem: false } } }]);
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
  test("a removed employee gets a message that doesn't tell them to log in", () => {
    const removed = { isAuthenticated: true, customer: { email: "a@tofoapp.com", eligibility: { value: JSON.stringify({ v: 1, status: "revoked" }) }, usage: null } };
    expect(errs(validateCart(vInput([tofoOnly], removed)))).toEqual([{ message: REMOVED_MESSAGE, target: "$.cart" }]);
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
