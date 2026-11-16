import { expect, test } from "vitest";
import { normalizeShop } from "../app/lib/shop-address";

test("store address from whatever the merchant types", () => {
  expect(normalizeShop("acme")).toBe("acme.myshopify.com");
  expect(normalizeShop(" Acme.myshopify.com ")).toBe("acme.myshopify.com");
  expect(normalizeShop("https://acme.myshopify.com/admin")).toBe("acme.myshopify.com");
  expect(normalizeShop("https://admin.shopify.com/store/acme/products")).toBe("acme.myshopify.com");
  expect(normalizeShop("")).toBe("");
});
