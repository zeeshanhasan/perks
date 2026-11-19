import db from "../db.server";
import { gql, type AdminClient } from "./admin-graphql.server";
import { parseExempt, planPageUrl, planState, type PlanState } from "./billing";
import { syncShopifyObjects } from "./settings.server";

// Billing through Shopify App Pricing (decision 017). Shopify hosts the plan page and charges the store;
// the app only reads the store's plan from the Partner API and sends stores without one to the plan page.
// Off until the Partner API env vars are set, so nothing changes before Zeeshan sets up the plans.

const PARTNER_API_VERSION = "2026-07";

export function billingConfig(env: NodeJS.ProcessEnv = process.env) {
  const orgId = env.SHOPIFY_PARTNER_ORG_ID ?? "";
  const token = env.SHOPIFY_PARTNER_API_ACCESS_TOKEN ?? "";
  const appGid = env.SHOPIFY_APP_GID ?? "";
  return {
    enabled: Boolean(orgId && token && appGid),
    orgId,
    token,
    appGid,
    appHandle: env.SHOPIFY_APP_HANDLE || "tofo-perks",
    basicHandle: env.PLAN_HANDLE_BASIC || "basic",
    standardHandle: env.PLAN_HANDLE_STANDARD || "standard",
    exempt: parseExempt(env.BILLING_EXEMPT_SHOPS),
  };
}
export type BillingConfig = ReturnType<typeof billingConfig>;

export type Subscription = {
  handle: string | null;
  trialEndsAt: string | null;
  billingPeriod: string | null;
  cancelAtEndOfCycle: boolean;
  /** Flat price in USD (0 on a free private plan or a no-charge dev store), null if not a flat price. */
  amount: number | null;
};

/** The store's live subscription, or null. Throws on any failure, so a hiccup never locks out a paying store. */
export async function fetchActiveSubscription(cfg: BillingConfig, shopGid: string, fetchImpl: typeof fetch = fetch): Promise<Subscription | null> {
  const res = await fetchImpl(`https://partners.shopify.com/${cfg.orgId}/api/${PARTNER_API_VERSION}/graphql.json`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": cfg.token },
    body: JSON.stringify({
      query: `query PerksActiveSubscription($appId: ID!, $shopId: ID!) {
        activeSubscription(appId: $appId, shopId: $shopId) {
          billingPeriod trialEndsAt cancelAtEndOfCycle
          items { handle price { __typename ... on FlatRatePrice { amount } } }
        }
      }`,
      variables: { appId: cfg.appGid, shopId: shopGid },
    }),
  });
  const json = (await res.json().catch(() => ({}))) as {
    data?: {
      activeSubscription: {
        billingPeriod?: string;
        trialEndsAt?: string;
        cancelAtEndOfCycle?: boolean;
        items?: { handle: string; price?: { amount?: string | number } | null }[];
      } | null;
    };
    errors?: unknown;
  };
  if (!res.ok || json.errors || !json.data) throw new Error(`Partner API failed: ${res.status}`);
  const s = json.data.activeSubscription;
  if (!s) return null;
  const raw = s.items?.[0]?.price?.amount;
  return {
    amount: raw === undefined || raw === null ? null : Number(raw),
    handle: s.items?.[0]?.handle ?? null,
    trialEndsAt: s.trialEndsAt ?? null,
    billingPeriod: s.billingPeriod ?? null,
    cancelAtEndOfCycle: Boolean(s.cancelAtEndOfCycle),
  };
}

export async function shopPlan(admin: AdminClient) {
  const data = await gql<{ shop: { id: string; plan: { publicDisplayName: string; partnerDevelopment: boolean } } }>(admin, `#graphql
    query PerksShopPlan { shop { id plan { publicDisplayName partnerDevelopment shopifyPlus } } }`);
  return { id: data.shop.id, name: data.shop.plan.publicDisplayName, dev: data.shop.plan.partnerDevelopment };
}

// Confirmed subscriptions only, for 5 minutes (Shopify's advice): a new approval is seen at once, a cancellation within minutes.
const cache = new Map<string, { until: number; sub: Subscription; shopifyPlan: string }>();
const FIVE_MIN = 5 * 60 * 1000;
export function clearBillingCache() {
  cache.clear();
}

export type BillingCheck =
  | { state: PlanState; subscription: Subscription | null; shopifyPlan: string | null; planUrl: string; billing: true }
  | { billing: false };

/** Runs on every app page (root loader). Saves the plan, and turns perks back on if they were paused. */
export async function checkBilling(
  admin: AdminClient,
  shop: string,
  cfg = billingConfig(),
  fetchImpl: typeof fetch = fetch,
  opts: { fresh?: boolean } = {},
): Promise<BillingCheck> {
  if (!cfg.enabled || cfg.exempt.has(shop.toLowerCase())) return { billing: false };
  const planUrl = planPageUrl(shop, cfg.appHandle);
  try {
    // Back from Shopify's plan page (it adds ?plan_handle=…): the plan just changed, so ask Shopify again.
    if (opts.fresh) cache.delete(shop);
    let hit = cache.get(shop);
    if (!hit || hit.until < Date.now()) {
      const sp = await shopPlan(admin);
      const sub = await fetchActiveSubscription(cfg, sp.id, fetchImpl);
      if (!sub) return { billing: true, state: { kind: "needs_plan" }, subscription: null, shopifyPlan: sp.name, planUrl };
      hit = { until: Date.now() + FIVE_MIN, sub, shopifyPlan: sp.name };
      cache.set(shop, hit);
    }
    const policy = await db.benefitPolicy.findUnique({ where: { shop } });
    const state = planState({
      subscribedHandle: hit.sub.handle,
      basicHandle: cfg.basicHandle,
      standardHandle: cfg.standardHandle,
      shopifyPlan: hit.shopifyPlan,
      planAtStart: policy?.planShopifyAtStart ?? null,
    });
    if (policy && state.kind === "ok") {
      const paused = Boolean(policy.billingPausedAt);
      if (paused || policy.planHandle !== hit.sub.handle || !policy.planShopifyAtStart) {
        await db.benefitPolicy.update({
          where: { shop },
          data: {
            planHandle: hit.sub.handle,
            planShopifyAtStart: policy.planShopifyAtStart ?? hit.shopifyPlan,
            billingPausedAt: null,
          },
        });
        if (paused) await syncShopifyObjects(admin, shop).catch((err) => console.error("[perks] resume after plan failed", shop, err));
      }
    }
    return { billing: true, state, subscription: hit.sub, shopifyPlan: hit.shopifyPlan, planUrl };
  } catch (err) {
    console.error("[perks] billing check failed (letting the store in)", shop, err);
    return { billing: false };
  }
}

/**
 * Hourly: stores whose plan ended (cancelled, frozen, expired) get their discount paused; stores that
 * subscribed again get it back. Only stores with the program set up are checked.
 */
export async function sweepBilling(
  adminFor: (shop: string) => Promise<AdminClient>,
  cfg = billingConfig(),
  fetchImpl: typeof fetch = fetch,
) {
  if (!cfg.enabled) return {};
  const policies = await db.benefitPolicy.findMany({ where: { discountId: { not: null } }, select: { shop: true, billingPausedAt: true } });
  const out: Record<string, string> = {};
  for (const p of policies) {
    if (cfg.exempt.has(p.shop.toLowerCase())) continue;
    // Uninstalled stores keep their settings for 48 hours but have no session: nothing to check.
    if (!(await db.session.findFirst({ where: { shop: p.shop, isOnline: false }, select: { id: true } }))) continue;
    try {
      const admin = await adminFor(p.shop);
      const sp = await shopPlan(admin);
      const sub = await fetchActiveSubscription(cfg, sp.id, fetchImpl);
      if (!sub && !p.billingPausedAt) {
        await db.benefitPolicy.update({ where: { shop: p.shop }, data: { billingPausedAt: new Date() } });
        await syncShopifyObjects(admin, p.shop);
        out[p.shop] = "paused";
      } else if (sub && p.billingPausedAt) {
        await db.benefitPolicy.update({ where: { shop: p.shop }, data: { billingPausedAt: null, planHandle: sub.handle } });
        await syncShopifyObjects(admin, p.shop);
        out[p.shop] = "resumed";
      }
    } catch (err) {
      console.error("[perks] billing sweep failed", p.shop, err);
      out[p.shop] = "error";
    }
    await new Promise((r) => setTimeout(r, 300)); // Partner API: 4 requests a second
  }
  return out;
}
