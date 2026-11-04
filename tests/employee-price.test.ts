/* eslint-disable @typescript-eslint/no-explicit-any */
import { createRequire } from "module";
import { describe, expect, it } from "vitest";

// The theme script is plain browser JS; load it with a fake window to test the price math.
const g = globalThis as unknown as { window: Record<string, unknown> & { TofoPerksPrice?: any } };
g.window = {};
createRequire(import.meta.url)("../extensions/perks-theme/assets/employee-mode.js");
const { employeePrice, formatMoney } = g.window.TofoPerksPrice;

describe("employee price (theme)", () => {
  it("applies a percentage", () => {
    expect(employeePrice(200000, { type: "percentage", value: 15 })).toBe(170000);
    expect(employeePrice(999, { type: "percentage", value: 10 })).toBe(899);
  });
  it("applies a fixed amount per item, never below zero, same currency only", () => {
    expect(employeePrice(200000, { type: "fixed", value: 200, sameCurrency: true })).toBe(180000);
    expect(employeePrice(10000, { type: "fixed", value: 200, sameCurrency: true })).toBe(0);
    expect(employeePrice(10000, { type: "fixed", value: 200, sameCurrency: false })).toBeNull();
  });
  it("formats with the shop's money format", () => {
    expect(formatMoney(170000, "Rs.{{amount}}")).toBe("Rs.1,700.00");
    expect(formatMoney(170000, "Rs {{amount_no_decimals}}")).toBe("Rs 1,700");
    expect(formatMoney(123456789, "€{{ amount_with_comma_separator }}")).toBe("€1.234.567,89");
  });
});

describe("theme app extension limits", () => {
  it("embed script stays under Shopify's 10 KB limit (over it, dev preview and deploy fail)", async () => {
    const { statSync } = await import("fs");
    expect(statSync(new URL("../extensions/perks-theme/assets/employee-mode.js", import.meta.url)).size).toBeLessThan(10_000);
  });
});
