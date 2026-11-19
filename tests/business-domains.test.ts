import { describe, expect, it } from "vitest";
import { discountValueError, parseBusinessForm } from "../app/lib/business";

const form = (domains: string) => {
  const f = new FormData();
  f.set("name", "Acme");
  f.set("domains", domains);
  f.set("discountType", "percentage");
  f.set("discountValue", "10");
  f.set("discountTarget", JSON.stringify({ all: true, products: [], collections: [], vendors: [], types: [] }));
  return f;
};

describe("business domains", () => {
  it("rejects public email providers", () => {
    const r = parseBusinessForm(form("acme.com, gmail.com"));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.domains).toMatch(/gmail.com is a public email provider/);
  });
  it("accepts company domains", () => {
    expect(parseBusinessForm(form("acme.com, acme.pk")).ok).toBe(true);
  });
});

describe("discount value (shared by the form and the server)", () => {
  it("accepts whole percentages from 1 to 90 and positive amounts", () => {
    expect(discountValueError("percentage", "15")).toBeNull();
    expect(discountValueError("fixed", "200.5")).toBeNull();
  });
  it("rejects what a number field reports for typos like 20E (empty), decimals and out-of-range values", () => {
    expect(discountValueError("percentage", "")).toBe("Whole number from 1 to 90");
    expect(discountValueError("percentage", "12.5")).toBe("Whole number from 1 to 90");
    expect(discountValueError("percentage", "95")).toBe("Whole number from 1 to 90");
    expect(discountValueError("fixed", "0")).toBe("Enter an amount greater than 0");
    expect(discountValueError("fixed", " ")).toBe("Enter an amount greater than 0");
  });
});
