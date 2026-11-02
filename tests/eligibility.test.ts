/* eslint-disable @typescript-eslint/no-explicit-any */
import { readFileSync } from "node:fs";
import { expect, test } from "vitest";
import { REVOKED_VALUE, addMonths, buildEligibilityValue, computeExpiry } from "../app/lib/eligibility";
import { isEligibleBuyer, parseEligibilityConfig } from "../extensions/perks-discount/src/eligibility";

const CFG = { domains: ["tofoapp.com"], autoDomain: true };
const today = "2026-11-02";
const buyer = (email: string | null, eligibility?: string | null, isAuthenticated = true) => ({
  isAuthenticated,
  customer: { email, eligibility: eligibility == null ? null : { value: eligibility } },
});

test("addMonths clamps to month end", () => {
  expect(addMonths(new Date("2026-01-31T10:00:00Z"), 1).toISOString()).toBe("2026-02-28T10:00:00.000Z");
  expect(addMonths(new Date("2026-11-02T00:00:00Z"), 12).toISOString()).toBe("2027-11-02T00:00:00.000Z");
});

test("computeExpiry supports no expiry", () => {
  expect(computeExpiry(new Date(), null)).toBeNull();
});

test("link-verified value round-trips through the Function check", () => {
  const v = JSON.stringify(buildEligibilityValue(new Date("2027-11-02T13:00:00Z")));
  expect(isEligibleBuyer(buyer("me@gmail.com", v), CFG, "2027-11-01")).toBe(true);
  expect(isEligibleBuyer(buyer("me@gmail.com", v), CFG, "2027-11-02")).toBe(false);
  expect(isEligibleBuyer(buyer("me@gmail.com", JSON.stringify(buildEligibilityValue(null))), CFG, "2099-01-01")).toBe(true);
});

test("logged-in account email at an approved domain is eligible automatically", () => {
  expect(isEligibleBuyer(buyer("zeeshan@tofoapp.com"), CFG, today)).toBe(true);
  expect(isEligibleBuyer(buyer("Zeeshan@TOFOAPP.com"), CFG, today)).toBe(true);
});

test.each([
  ["look-alike", "zeeshan@tofoapp.co"],
  ["suffix attack", "zeeshan@tofoapp.com.evil.io"],
  ["subdomain", "zeeshan@sub.tofoapp.com"],
  ["no email", null],
])("domain check rejects %s", (_n, email) => {
  expect(isEligibleBuyer(buyer(email), CFG, today)).toBe(false);
});

test("auto-domain off: domain alone is not enough", () => {
  expect(isEligibleBuyer(buyer("zeeshan@tofoapp.com"), { ...CFG, autoDomain: false }, today)).toBe(false);
});

test("revoked overrides both domain and link verification", () => {
  expect(isEligibleBuyer(buyer("zeeshan@tofoapp.com", JSON.stringify(REVOKED_VALUE)), CFG, today)).toBe(false);
});

test("guests and unauthenticated buyers never qualify", () => {
  expect(isEligibleBuyer(null, CFG, today)).toBe(false);
  expect(isEligibleBuyer({ isAuthenticated: false, customer: null }, CFG, today)).toBe(false);
  expect(isEligibleBuyer(buyer("zeeshan@tofoapp.com", null, false), CFG, today)).toBe(false);
});

test.each([
  [""],
  ["not json"],
  ["{}"],
  ['{"v":2,"status":"active","expiresAt":null}'],
  ['{"v":1,"status":"active","expiresAt":"tomorrow"}'],
  ['{"v":1,"status":"active"}'],
  ["true"],
])("bad metafield %s fails closed (no domain match)", (raw) => {
  expect(isEligibleBuyer(buyer("me@gmail.com", raw), CFG, today)).toBe(false);
});

test("parseEligibilityConfig is defensive", () => {
  expect(parseEligibilityConfig(null)).toEqual({ domains: [], autoDomain: false });
  expect(parseEligibilityConfig({ domains: ["A.COM", 3], autoDomain: "yes" })).toEqual({ domains: ["a.com"], autoDomain: false });
});

test("both Function copies of eligibility.ts are identical", () => {
  expect(readFileSync("extensions/perks-discount/src/eligibility.ts", "utf8")).toBe(
    readFileSync("extensions/perks-validation/src/eligibility.ts", "utf8"),
  );
});
