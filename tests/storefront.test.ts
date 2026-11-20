import { describe, expect, it } from "vitest";
import { STOREFRONT_DEFAULTS, embedEnabled, parseStorefront, storefrontFromForm } from "../app/lib/storefront";

describe("storefront options", () => {
  it("falls back to defaults", () => {
    expect(parseStorefront("{}")).toEqual(STOREFRONT_DEFAULTS);
    expect(parseStorefront("not json")).toEqual(STOREFRONT_DEFAULTS);
  });
  it("keeps edits, trims and caps text, empty text means default", () => {
    const f = new FormData();
    f.set("showPrice", "on");
    f.set("priceLabel", "  Staff   price ");
    f.set("noticeTitle", "");
    f.set("noticeBody", "x".repeat(500));
    const o = storefrontFromForm(f);
    expect(o.showPrice).toBe(true);
    expect(o.hideProducts).toBe(false);
    expect(o.priceLabel).toBe("Staff price");
    expect(o.noticeTitle).toBe(STOREFRONT_DEFAULTS.noticeTitle);
    expect(o.noticeBody).toHaveLength(240);
  });
});

describe("embedEnabled", () => {
  const data = (blocks: object) => `/* comment */\n${JSON.stringify({ current: { blocks } })}`;
  it("detects the embed on, off, missing", () => {
    expect(embedEnabled(data({ a: { type: "shopify://apps/perks/blocks/employee-mode/123", disabled: false } }))).toBe(true);
    expect(embedEnabled(data({ a: { type: "shopify://apps/perks/blocks/employee-mode/123", disabled: true } }))).toBe(false);
    expect(embedEnabled(data({ a: { type: "shopify://apps/other/blocks/reviews/1" } }))).toBe(false);
    expect(embedEnabled(null)).toBeNull();
    expect(embedEnabled("{bad")).toBeNull();
  });
  it("only counts this app's embed when the dev and production apps share a store", () => {
    const both = data({
      dev: { type: "shopify://apps/perks/blocks/employee-mode/01a1", disabled: false },
      prod: { type: "shopify://apps/employee-perks/blocks/employee-mode/01a2", disabled: true },
    });
    expect(embedEnabled(both, { title: "perks", handle: "perks-5" })).toBe(true);
    expect(embedEnabled(both, { title: "Employee Perks", handle: "tofo-perks" })).toBe(false);
    const onlyProd = data({ prod: { type: "shopify://apps/employee-perks/blocks/employee-mode/01a2", disabled: false } });
    expect(embedEnabled(onlyProd, { title: "perks", handle: "perks-5" })).toBe(false);
  });
  it("still finds an embed added under the old name", () => {
    const old = data({ a: { type: "shopify://apps/tofo-perks/blocks/employee-mode/9", disabled: false } });
    expect(embedEnabled(old, { title: "Employee Perks", handle: "tofo-perks" })).toBe(true);
  });
});

describe("badge colours (set in the app, theme editor is the fallback)", () => {
  it("keeps valid #rrggbb colours, lowercased, and drops anything else", () => {
    expect(parseStorefront({ badgeBg: "#E3F1DF", badgeFg: "#0c5132" })).toMatchObject({ badgeBg: "#e3f1df", badgeFg: "#0c5132" });
    expect(parseStorefront({ badgeBg: "red", badgeFg: "#fff" })).toMatchObject({ badgeBg: "", badgeFg: "" });
    expect(parseStorefront("{}")).toMatchObject({ badgeBg: "", badgeFg: "" });
  });
});
