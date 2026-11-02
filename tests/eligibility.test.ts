/* eslint-disable @typescript-eslint/no-explicit-any */
import { expect, test } from "vitest";
import { addMonths, buildEligibilityValue, computeExpiry } from "../app/lib/eligibility";
import { isEligible } from "../extensions/perks-discount/src/eligibility";
import { isEligible as isEligibleV } from "../extensions/perks-validation/src/eligibility";

test("addMonths clamps to month end", () => {
  expect(addMonths(new Date("2026-01-31T10:00:00Z"), 1).toISOString()).toBe("2026-02-28T10:00:00.000Z");
  expect(addMonths(new Date("2026-11-02T00:00:00Z"), 12).toISOString()).toBe("2027-11-02T00:00:00.000Z");
});

test("computeExpiry supports no expiry", () => {
  expect(computeExpiry(new Date(), null)).toBeNull();
});

test("published value round-trips through the Function check", () => {
  const v = JSON.stringify(buildEligibilityValue(new Date("2027-11-02T13:00:00Z")));
  expect(isEligible(v, "2027-11-01")).toBe(true);
  expect(isEligible(v, "2027-11-02")).toBe(false);
  expect(isEligible(JSON.stringify(buildEligibilityValue(null)), "2099-01-01")).toBe(true);
});

test.each([
  [null],
  [""],
  ["not json"],
  ["{}"],
  ['{"v":1,"status":"revoked","expiresAt":null}'],
  ['{"v":2,"status":"active","expiresAt":null}'],
  ['{"v":1,"status":"active","expiresAt":"tomorrow"}'],
  ['{"v":1,"status":"active"}'],
  ["true"],
])("fails closed for %s", (raw) => {
  expect(isEligible(raw as any, "2026-11-02")).toBe(false);
  expect(isEligibleV(raw as any, "2026-11-02")).toBe(false);
});

test("both Function copies of isEligible are identical", async () => {
  const { readFileSync } = await import("node:fs");
  expect(readFileSync("extensions/perks-discount/src/eligibility.ts", "utf8")).toBe(
    readFileSync("extensions/perks-validation/src/eligibility.ts", "utf8"),
  );
});
