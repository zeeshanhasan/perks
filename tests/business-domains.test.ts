import { describe, expect, it } from "vitest";
import { parseBusinessForm } from "../app/lib/business";

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
