import { describe, expect, it } from "vitest";
import { perksPage, publicAppliesTo } from "../app/lib/proxy-page";
import { STOREFRONT_DEFAULTS, parseStorefront, themeOptions } from "../app/lib/storefront";

const target = (over: Partial<Parameters<typeof publicAppliesTo>[0]> = {}) => ({
  all: false,
  collections: [],
  products: [],
  vendors: [],
  types: [],
  ...over,
});

describe("publicAppliesTo", () => {
  it("describes what the discount covers", () => {
    expect(publicAppliesTo(target({ all: true }))).toBe("On everything in the store");
    expect(publicAppliesTo(target({ collections: [{ title: "Hydrogen" }] }))).toBe("On Hydrogen");
    expect(
      publicAppliesTo(target({ collections: [{ title: "A" }, { title: "B" }], products: [{ title: "C" }, { title: "D" }] })),
    ).toBe("On A, B, C and 1 more");
    expect(publicAppliesTo(target())).toBe("On selected products");
  });
});

describe("perksPage", () => {
  const item = { name: "Acme <b>", discount: "10% off", appliesTo: "On everything in the store", domains: ["acme.com"] };

  it("lists companies with escaped text and no Liquid injection", () => {
    const html = perksPage({ title: "Perks {{ x }}", intro: "Hi", items: [item], showDomains: true, loggedIn: false });
    expect(html).toContain("Acme &#60;b&#62;");
    expect(html).not.toContain("{{ x }}");
    expect(html).toContain("@acme.com");
    expect(html).toContain("/apps/perks/verify");
    expect(html).toContain("Get my perks");
  });
  it("can hide domains and handles an empty list", () => {
    expect(perksPage({ title: "T", intro: "I", items: [item], showDomains: false, loggedIn: true })).not.toContain("@acme.com");
    expect(perksPage({ title: "T", intro: "I", items: [], showDomains: true, loggedIn: false })).toContain("no employee perks");
  });
});

describe("perks page options", () => {
  it("is off by default and stays out of the theme data", () => {
    const o = parseStorefront("{}");
    expect(o.perksPage).toBe(false);
    expect(STOREFRONT_DEFAULTS.perksPageDomains).toBe(true);
    const t = themeOptions(o) as Record<string, unknown>;
    expect(t.perksPage).toBeUndefined();
    expect(t.perksPageIntro).toBeUndefined();
    expect(t.priceLabel).toBe(o.priceLabel);
  });
});
