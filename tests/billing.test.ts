/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, test } from "vitest";
import db from "../app/db.server";
import { parseExempt, planPageUrl, planState, tierForShopifyPlan } from "../app/lib/billing";
import { billingConfig, checkBilling, clearBillingCache, fetchActiveSubscription, sweepBilling } from "../app/lib/billing.server";
import { fakeAdmin } from "./fake-admin";

const SHOP = "perks-billing.myshopify.com";
const ENV = {
  SHOPIFY_PARTNER_ORG_ID: "123",
  SHOPIFY_PARTNER_API_ACCESS_TOKEN: "prtapi_test",
  SHOPIFY_APP_GID: "gid://shopify/App/9",
} as unknown as NodeJS.ProcessEnv;

/** Fake Partner API: returns the given subscription (null = none), or fails. */
function partner(sub: any, fail = false) {
  const seen: any[] = [];
  const f = (async (_url: string, init: any) => {
    seen.push(JSON.parse(init.body));
    if (fail) return new Response("busy", { status: 429 });
    return Response.json({ data: { activeSubscription: sub } });
  }) as unknown as typeof fetch;
  return { f, seen };
}
const sub = (handle: string) => ({ billingPeriod: "MONTHLY", trialEndsAt: "2026-12-17T00:00:00Z", cancelAtEndOfCycle: false, items: [{ handle }] });
const adminOn = (plan: string) =>
  fakeAdmin({ PerksShopPlan: () => ({ shop: { id: "gid://shopify/Shop/5", plan: { publicDisplayName: plan, partnerDevelopment: false, shopifyPlus: false } } }) });

beforeEach(async () => {
  clearBillingCache();
  await db.benefitPolicy.deleteMany({ where: { shop: SHOP } });
  await db.benefitPolicy.create({ data: { shop: SHOP, enabled: true } });
});

describe("pricing rules (decision 017)", () => {
  test("Basic and Starter stores get the $9 price; every other plan $19", () => {
    expect(tierForShopifyPlan("Basic")).toBe("basic");
    expect(tierForShopifyPlan("Starter")).toBe("basic");
    expect(tierForShopifyPlan("Grow")).toBe("standard");
    expect(tierForShopifyPlan("Shopify Plus")).toBe("standard");
  });

  test("a Grow store on the $9 plan is asked to switch, but a Basic store that upgraded keeps it", () => {
    const base = { basicHandle: "basic" };
    expect(planState({ ...base, subscribedHandle: null, shopifyPlan: "Basic", planAtStart: null }).kind).toBe("needs_plan");
    expect(planState({ ...base, subscribedHandle: "standard", shopifyPlan: "Basic", planAtStart: null })).toEqual({ kind: "ok", tier: "standard" });
    expect(planState({ ...base, subscribedHandle: "basic", shopifyPlan: "Grow", planAtStart: null }).kind).toBe("wrong_plan");
    expect(planState({ ...base, subscribedHandle: "basic", shopifyPlan: "Grow", planAtStart: "Basic" })).toEqual({ kind: "ok", tier: "basic" });
  });

  test("a private plan (e.g. $0 for a partner's store) is always fine, even on a big Shopify plan", () => {
    expect(planState({ basicHandle: "basic", subscribedHandle: "comped", shopifyPlan: "Shopify Plus", planAtStart: null })).toEqual({ kind: "ok", tier: null });
  });

  test("plan page and exempt list", () => {
    expect(planPageUrl(SHOP, "tofo-perks")).toBe("https://admin.shopify.com/store/perks-billing/charges/tofo-perks/pricing_plans");
    expect([...parseExempt(" A.myshopify.com, b.myshopify.com\nc.myshopify.com ")]).toEqual(["a.myshopify.com", "b.myshopify.com", "c.myshopify.com"]);
  });
});

describe("plan check", () => {
  test("off until the Partner API is set up, and for exempt stores", async () => {
    const { admin } = adminOn("Basic");
    expect(await checkBilling(admin, SHOP, billingConfig({} as NodeJS.ProcessEnv))).toEqual({ billing: false });
    const exempt = billingConfig({ ...ENV, BILLING_EXEMPT_SHOPS: SHOP } as NodeJS.ProcessEnv);
    expect(await checkBilling(admin, SHOP, exempt)).toEqual({ billing: false });
  });

  test("no subscription sends the store to the plan page", async () => {
    const { admin } = adminOn("Basic");
    const p = partner(null);
    const r = await checkBilling(admin, SHOP, billingConfig(ENV), p.f);
    expect(r.billing && r.state.kind).toBe("needs_plan");
    expect(p.seen[0].variables).toEqual({ appId: "gid://shopify/App/9", shopId: "gid://shopify/Shop/5" });
  });

  test("reads the plan's price, so a $0 private plan shows as free", async () => {
    const free = { billingPeriod: "EVERY_30_DAYS", trialEndsAt: null, cancelAtEndOfCycle: false, items: [{ handle: "comped", price: { __typename: "FlatRatePrice", amount: "0.0" } }] };
    const s = await fetchActiveSubscription(billingConfig(ENV), "gid://shopify/Shop/5", partner(free).f);
    expect(s).toMatchObject({ handle: "comped", amount: 0 });
  });

  test("a Partner API failure never locks out a store", async () => {
    const { admin } = adminOn("Basic");
    expect(await checkBilling(admin, SHOP, billingConfig(ENV), partner(null, true).f)).toEqual({ billing: false });
    await expect(fetchActiveSubscription(billingConfig(ENV), "x", partner(null, true).f)).rejects.toThrow();
  });

  test("first subscription saves the Shopify plan, so upgrading Shopify later keeps the $9 price", async () => {
    const { admin } = adminOn("Basic");
    const r = await checkBilling(admin, SHOP, billingConfig(ENV), partner(sub("basic")).f);
    expect(r.billing && r.state).toEqual({ kind: "ok", tier: "basic" });
    const policy = await db.benefitPolicy.findUniqueOrThrow({ where: { shop: SHOP } });
    expect([policy.planHandle, policy.planShopifyAtStart]).toEqual(["basic", "Basic"]);

    clearBillingCache();
    const later = await checkBilling(adminOn("Grow").admin, SHOP, billingConfig(ENV), partner(sub("basic")).f);
    expect(later.billing && later.state.kind).toBe("ok");
  });
});

  test("coming back from the plan page sees the new plan at once, not the cached one", async () => {
    const { admin } = adminOn("Grow");
    const first = await checkBilling(admin, SHOP, billingConfig(ENV), partner(sub("basic")).f);
    expect(first.billing && first.state.kind).toBe("wrong_plan");
    const cached = await checkBilling(admin, SHOP, billingConfig(ENV), partner(sub("standard")).f);
    expect(cached.billing && cached.state.kind).toBe("wrong_plan"); // within 5 minutes: cache
    const back = await checkBilling(admin, SHOP, billingConfig(ENV), partner(sub("standard")).f, { fresh: true });
    expect(back.billing && back.state).toEqual({ kind: "ok", tier: "standard" });
});

describe("hourly sweep", () => {
  test("pauses the discount when the plan ends and resumes it when it's back", async () => {
    await db.benefitPolicy.update({ where: { shop: SHOP }, data: { discountId: "gid://shopify/DiscountAutomaticNode/1" } });
    // A store without a session (uninstalled) is skipped; with one, it's checked.
    await db.session.deleteMany({ where: { shop: SHOP } });
    expect(await sweepBilling(async () => fakeAdmin().admin, billingConfig(ENV), partner(null).f)).toEqual({});
    await db.session.create({ data: { id: `offline_${SHOP}`, shop: SHOP, state: "x", isOnline: false, accessToken: "test" } });
    const { admin, calls } = adminOn("Basic");
    expect(await sweepBilling(async () => admin, billingConfig(ENV), partner(null).f)).toEqual({ [SHOP]: "paused" });
    expect((await db.benefitPolicy.findUniqueOrThrow({ where: { shop: SHOP } })).billingPausedAt).not.toBeNull();
    const toggle = calls.filter((c) => c.op === "PerksDiscountToggle").pop();
    expect(toggle).toBeTruthy();

    expect(await sweepBilling(async () => admin, billingConfig(ENV), partner(sub("basic")).f)).toEqual({ [SHOP]: "resumed" });
    expect((await db.benefitPolicy.findUniqueOrThrow({ where: { shop: SHOP } })).billingPausedAt).toBeNull();
  });
});
