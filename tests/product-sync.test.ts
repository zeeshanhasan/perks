import { beforeEach, describe, expect, test } from "vitest";
import db from "../app/db.server";
import { markProductsChanged, QUIET_MS, runProductSync, shopsDueForProductSync } from "../app/lib/product-sync.server";
import { fakeAdmin } from "./fake-admin";

const SHOP = "perks-productsync.myshopify.com";
const t0 = new Date("2026-11-20T10:00:00Z");
const later = (ms: number) => new Date(t0.getTime() + ms);

beforeEach(async () => {
  await db.session.deleteMany({ where: { shop: SHOP } });
  await db.benefitPolicy.deleteMany({ where: { shop: SHOP } });
  await db.benefitPolicy.create({ data: { shop: SHOP, enabled: true, discountId: "gid://shopify/DiscountAutomaticNode/1" } });
  await db.session.create({ data: { id: `offline_${SHOP}`, shop: SHOP, state: "x", isOnline: false, accessToken: "test" } });
});

describe("refresh after product changes (batched)", () => {
  test("waits until changes have been quiet for a minute, then syncs once", async () => {
    await markProductsChanged(SHOP, t0);
    expect(await shopsDueForProductSync(later(QUIET_MS - 1000))).not.toContain(SHOP);
    // An import keeps sending webhooks: each one pushes the sync back.
    await markProductsChanged(SHOP, later(30_000));
    expect(await shopsDueForProductSync(later(QUIET_MS + 1000))).not.toContain(SHOP);
    expect(await shopsDueForProductSync(later(30_000 + QUIET_MS))).toContain(SHOP);
  });

  test("after a sync the store isn't due again until products change again", async () => {
    await markProductsChanged(SHOP, t0);
    const { admin } = fakeAdmin();
    const out = await runProductSync(async () => admin, later(QUIET_MS + 1));
    expect(out[SHOP]).toBeDefined();
    expect(await shopsDueForProductSync(later(QUIET_MS * 10))).not.toContain(SHOP);
    await markProductsChanged(SHOP, later(QUIET_MS * 2));
    expect(await shopsDueForProductSync(later(QUIET_MS * 3 + 1))).toContain(SHOP);
  });

  test("stores without the program set up or without a session are skipped", async () => {
    await markProductsChanged(SHOP, t0);
    await db.session.deleteMany({ where: { shop: SHOP } });
    expect(await runProductSync(async () => fakeAdmin().admin, later(QUIET_MS + 1))).toEqual({});
    await db.benefitPolicy.update({ where: { shop: SHOP }, data: { discountId: null } });
    expect(await shopsDueForProductSync(later(QUIET_MS + 1))).not.toContain(SHOP);
  });
});
