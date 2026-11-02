import { describe, expect, test } from "vitest";
import { isApprovedEmail, maskEmail, normalizeEmail, parseDomainList } from "../app/lib/domain";

const approved = ["tofoapp.com"];

describe("isApprovedEmail (exact domain match)", () => {
  test.each([
    ["zeeshan@tofoapp.com", true],
    ["  Zeeshan@TOFOAPP.COM ", true],
    ["zeeshan@tofoapp.co", false],
    ["zeeshan@tofoapp.com.evil.io", false],
    ["zeeshan@sub.tofoapp.com", false],
    ["zeeshan@xtofoapp.com", false],
    ["zeeshan@tofoapp.com@evil.io", false],
    ["zeeshan@evil.io?x=@tofoapp.com", false],
    ["tofoapp.com", false],
    ["@tofoapp.com", false],
    ["a..b@tofoapp.com", false],
    ["", false],
  ])("%s -> %s", (email, ok) => {
    expect(isApprovedEmail(email, approved)).toBe(ok);
  });
});

test("normalizeEmail lowercases and trims", () => {
  expect(normalizeEmail("  A.B@Example.COM ")).toBe("a.b@example.com");
  expect(normalizeEmail("no-at-sign")).toBeNull();
});

test("parseDomainList dedupes and flags invalid", () => {
  expect(parseDomainList("Tofoapp.com, @example.pk\n tofoapp.com bad_domain")).toEqual({
    domains: ["tofoapp.com", "example.pk"],
    invalid: ["bad_domain"],
  });
});

test("maskEmail hides the local part", () => {
  expect(maskEmail("zeeshan@tofoapp.com")).toBe("z***@tofoapp.com");
});
