import db from "../db.server";
import type { AdminClient } from "./admin-graphql.server";
import { parseExempt, planPageUrl, planState, type PlanState } from "./billing";
import { syncShopifyObjects } from "./settings.server";
import { timed, type Timing } from "./timing.server";
import { clearShopMemory, shopDetails } from "./shop-cache.server";

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

// The live subscription is saved in the database for an hour (Shopify's Partner API is the slowest
// call we make). The hourly sweep re-checks every store anyway, and a return from Shopify's plan page
// (?plan_handle=) always re-checks at once. "No plan" is never saved, so a store that just subscribed
// is let in straight away.
export const BILLING_TTL = 60 * 60_000;

/** Kept for tests: the caches now live in the database (ShopCache) plus a small memory layer. */
export function clearBillingCache() {
  clearShopMemory();
}

export type BillingCheck =
  | { state: PlanState; subscription: Subscription | null; shopifyPlan: string | null; planUrl: string; billing: true }
  | { billing: false };

async function savedSubscription(shop: string, now: number): Promise<Subscription | null> {
  const row = await db.shopCache.findUnique({ where: { shop }, select: { billing: true, billingAt: true } });
  if (!row?.billing || !row.billingAt || now - row.billingAt.getTime() >= BILLING_TTL) return null;
  try {
    return JSON.parse(row.billing) as Subscription;
  } catch {
    return null;
  }
}

async function saveSubscription(shop: string, sub: Subscription | null, now: number) {
  await db.shopCache.updateMany({
    where: { shop },
    data: sub ? { billing: JSON.stringify(sub), billingAt: new Date(now) } : { billing: null, billingAt: null },
  });
}

/** Runs on every app page (root loader). Saves the plan, and turns perks back on if they were paused. */
export async function checkBilling(
  admin: AdminClient,
  shop: string,
  cfg = billingConfig(),
  fetchImpl: typeof fetch = fetch,
  opts: { fresh?: boolean; timing?: Timing; now?: number } = {},
): Promise<BillingCheck> {
  const t = opts.timing;
  const now = opts.now ?? Date.now();
  if (!cfg.enabled || cfg.exempt.has(shop.toLowerCase())) return { billing: false };
  const planUrl = planPageUrl(shop, cfg.appHandle);
  try {
    const [details, dMs] = await timed(() => shopDetails(admin, shop, now));
    t?.add("billing.shop", dMs);
    let sub = opts.fresh ? null : await savedSubscription(shop, now);
    if (sub) {
      t?.add("billing.cached", 0);
    } else {
      const [live, subMs] = await timed(() => fetchActiveSubscription(cfg, details.gid, fetchImpl));
      t?.add("billing.partnerApi", subMs);
      await saveSubscription(shop, live, now);
      if (!live) return { billing: true, state: { kind: "needs_plan" }, subscription: null, shopifyPlan: details.shopifyPlan, planUrl };
      sub = live;
    }
    const [policy, dbMs] = await timed(() => db.benefitPolicy.findUnique({ where: { shop } }));
    t?.add("billing.db", dbMs);
    const state = planState({
      subscribedHandle: sub.handle,
      basicHandle: cfg.basicHandle,
      standardHandle: cfg.standardHandle,
      shopifyPlan: details.shopifyPlan,
      planAtStart: policy?.planShopifyAtStart ?? null,
    });
    if (policy && state.kind === "ok") {
      const paused = Boolean(policy.billingPausedAt);
      if (paused || policy.planHandle !== sub.handle || !policy.planShopifyAtStart) {
        await db.benefitPolicy.update({
          where: { shop },
          data: {
            planHandle: sub.handle,
            planShopifyAtStart: policy.planShopifyAtStart ?? details.shopifyPlan,
            billingPausedAt: null,
          },
        });
        if (paused) await syncShopifyObjects(admin, shop).catch((err) => console.error("[perks] resume after plan failed", shop, err));
      }
    }
    return { billing: true, state, subscription: sub, shopifyPlan: details.shopifyPlan, planUrl };
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
    let admin: AdminClient;
    try {
      admin = await adminFor(p.shop);
    } catch (err) {
      // The library throws a Response when the store's token can't be used or refreshed: the app was uninstalled
      // and the uninstall webhook never cleared the session. Clear it as the webhook would, so later sweeps skip it.
      if (err instanceof Response) {
        await db.session.deleteMany({ where: { shop: p.shop } });
        console.log("[perks] billing sweep: no access to", p.shop, "(uninstalled), session cleared");
        out[p.shop] = "no access";
      } else {
        console.error("[perks] billing sweep failed", p.shop, err);
        out[p.shop] = "error";
      }
      continue;
    }
    try {
      const details = await shopDetails(admin, p.shop);
      const sub = await fetchActiveSubscription(cfg, details.gid, fetchImpl);
      await saveSubscription(p.shop, sub, Date.now());
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
