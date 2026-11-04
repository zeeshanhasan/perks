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
});
