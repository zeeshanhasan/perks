/* eslint-disable @typescript-eslint/no-explicit-any */
import { readFileSync } from "node:fs";
import { expect, test } from "vitest";
import { REVOKED_VALUE, addMonths, buildEligibilityValue, computeExpiry } from "../app/lib/eligibility";
import { matches, parseConfig, resolveBusiness, usedInPeriod, withinLimit } from "../extensions/perks-discount/src/eligibility";

const T0 = { all: false, productIds: [], collectionIds: [], vendors: [], types: [] };
const biz = (id: string, domains: string[], extra: Record<string, unknown> = {}) => ({
  id, domains, type: "percentage", value: 15, target: { ...T0, all: true }, employeeOnly: T0, limit: null, ...extra,
});
const cfg = (o: Record<string, unknown> = {}) =>
  parseConfig(JSON.stringify({ v: 2, autoDomain: true, excluded: [], businesses: [biz("tofo", ["tofoapp.com"]), biz("goog", ["google.com", "google.pk"], { value: 10 })], ...o }))!;
const today = "2026-11-02";
const buyer = (email: string | null, eligibility?: string | null, isAuthenticated = true) => ({
  isAuthenticated,
  customer: { email, eligibility: eligibility == null ? null : { value: eligibility } },
});

test("addMonths clamps to month end; computeExpiry supports no expiry", () => {
  expect(addMonths(new Date("2026-01-31T10:00:00Z"), 1).toISOString()).toBe("2026-02-28T10:00:00.000Z");
  expect(computeExpiry(new Date(), null)).toBeNull();
});

test("work-email login resolves to the business owning the domain", () => {
  expect(resolveBusiness(buyer("a@tofoapp.com"), cfg(), today)?.id).toBe("tofo");
  expect(resolveBusiness(buyer("a@GOOGLE.pk"), cfg(), today)?.id).toBe("goog");
  expect(resolveBusiness(buyer("a@gmail.com"), cfg(), today)).toBeNull();
});

test.each([["x@tofoapp.co"], ["x@tofoapp.com.evil.io"], ["x@sub.tofoapp.com"], [null]])("rejects %s", (email) => {
  expect(resolveBusiness(buyer(email), cfg(), today)).toBeNull();
});

test("link verification carries the business; legacy values map to the first business", () => {
  const v = JSON.stringify(buildEligibilityValue(new Date("2027-11-02T13:00:00Z"), "goog"));
  expect(resolveBusiness(buyer("me@gmail.com", v), cfg(), "2027-11-01")?.id).toBe("goog");
  expect(resolveBusiness(buyer("me@gmail.com", v), cfg(), "2027-11-02")).toBeNull();
  const legacy = JSON.stringify({ v: 1, status: "active", expiresAt: null });
  expect(resolveBusiness(buyer("me@gmail.com", legacy), cfg(), today)?.id).toBe("tofo");
});

test("verified for a deleted business falls back to domain, else nothing", () => {
  const v = JSON.stringify(buildEligibilityValue(null, "gone"));
  expect(resolveBusiness(buyer("me@gmail.com", v), cfg(), today)).toBeNull();
  expect(resolveBusiness(buyer("me@google.com", v), cfg(), today)?.id).toBe("goog");
});

test("revoked overrides everything; guests and unauthenticated never qualify", () => {
  expect(resolveBusiness(buyer("a@tofoapp.com", JSON.stringify(REVOKED_VALUE)), cfg(), today)).toBeNull();
  expect(resolveBusiness(null, cfg(), today)).toBeNull();
  expect(resolveBusiness(buyer("a@tofoapp.com", null, false), cfg(), today)).toBeNull();
});

test("auto-domain off: domain alone is not enough", () => {
  expect(resolveBusiness(buyer("a@tofoapp.com"), cfg({ autoDomain: false }), today)).toBeNull();
});

test("bad config fails closed", () => {
  expect(parseConfig(null)).toBeNull();
  expect(parseConfig("{")).toBeNull();
  expect(parseConfig(JSON.stringify({ v: 1 }))).toBeNull();
  const c = parseConfig(JSON.stringify({ v: 2, businesses: [biz("bad", ["x.com"], { value: 95 }), { domains: [] }] }))!;
  expect(c.businesses).toEqual([]);
});

test("matches: products, collections, vendors (case-insensitive) and types", () => {
  const t = { all: false, productIds: ["gid://shopify/Product/1"], collectionIds: ["gid://shopify/Collection/9"], vendors: ["nature's way"], types: ["vitamins"] };
  expect(matches({ id: "gid://shopify/Product/1" }, t)).toBe(true);
  expect(matches({ id: "p2", vendor: "Nature's Way" }, t)).toBe(true);
  expect(matches({ id: "p2", productType: "VITAMINS" }, t)).toBe(true);
  expect(matches({ id: "p2", inCollections: [{ collectionId: "gid://shopify/Collection/9", isMember: true }] }, t)).toBe(true);
  expect(matches({ id: "p2", inCollections: [{ collectionId: "gid://shopify/Collection/9", isMember: false }] }, t)).toBe(false);
  expect(matches({ id: "p2", vendor: "Other" }, t)).toBe(false);
});

test("limits: monthly/annual, discount/spend, period rollover, unreadable usage fails closed", () => {
  const c = cfg({
    businesses: [biz("tofo", ["tofoapp.com"], { limit: { period: "month", basis: "discount", amount: 5000 } }), biz("y", ["y.com"], { limit: { period: "year", basis: "spend", amount: 100000 } })],
  });
  const [m, y] = c.businesses;
  const usage = JSON.stringify({ v: 1, m: "2026-11", y: "2026", b: { tofo: { md: 4999, ms: 0, yd: 9000, ys: 0 }, y: { md: 0, ms: 0, yd: 0, ys: 100000 } } });
  expect(withinLimit(usage, m, today)).toBe(true);
  expect(usedInPeriod(usage, m, today)).toBe(4999);
  expect(withinLimit(JSON.stringify({ v: 1, m: "2026-11", y: "2026", b: { tofo: { md: 5000 } } }), m, today)).toBe(false);
  expect(withinLimit(usage, m, "2026-12-01")).toBe(true); // new month resets
  expect(withinLimit(usage, y, today)).toBe(false);
  expect(withinLimit(usage, y, "2027-01-01")).toBe(true);
  expect(withinLimit("{", m, today)).toBe(false);
  expect(withinLimit(null, m, today)).toBe(true);
});

test("both Function copies of eligibility.ts are identical", () => {
  expect(readFileSync("extensions/perks-discount/src/eligibility.ts", "utf8")).toBe(
    readFileSync("extensions/perks-validation/src/eligibility.ts", "utf8"),
  );
});
