import { describe, expect, it } from "vitest";
import { joinedBy, limitUsage } from "../app/lib/customer-perks";

const u = { md: 1200, ms: 9000, yd: 3000, ys: 20000 };

describe("limitUsage", () => {
  it("is null without a limit", () => {
    expect(limitUsage({ limitPeriod: "none", limitBasis: "discount", limitAmount: 5000 }, u)).toBeNull();
    expect(limitUsage({ limitPeriod: "month", limitBasis: "discount", limitAmount: null }, u)).toBeNull();
  });
  it("uses the right period and basis", () => {
    expect(limitUsage({ limitPeriod: "month", limitBasis: "discount", limitAmount: 5000 }, u)).toEqual({
      period: "month", basis: "discount", limit: 5000, used: 1200, left: 3800, percent: 24,
    });
    expect(limitUsage({ limitPeriod: "year", limitBasis: "spend", limitAmount: 10000 }, u)).toMatchObject({ used: 20000, left: 0, percent: 100 });
  });
  it("treats a customer with no orders as nothing used", () => {
    expect(limitUsage({ limitPeriod: "month", limitBasis: "spend", limitAmount: 100 }, undefined)).toMatchObject({ used: 0, left: 100, percent: 0 });
  });
});

describe("joinedBy", () => {
  it("names how they joined", () => {
    expect(joinedBy("domain")).toBe("Work-email login");
    expect(joinedBy("link")).toBe("Verified by email link");
  });
});
