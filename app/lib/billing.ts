// Pricing rules (decision 017), kept pure so they're easy to test.
// Basic ($9) is for stores on Shopify's Basic or Starter plan; Standard ($19) for every other plan.
// A store keeps the price it started on: the check uses the Shopify plan it had when it first subscribed.

export const PRICES = {
  basic: { name: "Basic", monthly: 9, yearly: 90 },
  standard: { name: "Standard", monthly: 19, yearly: 190 },
} as const;
export const TRIAL_DAYS = 30;

export type Tier = keyof typeof PRICES;

/** Shopify's Basic and Starter plans get the Basic price. Plan names come from `shop.plan.publicDisplayName`. */
export function tierForShopifyPlan(planName: string | null | undefined): Tier {
  const p = (planName ?? "").toLowerCase();
  return p.includes("basic") || p.includes("starter") ? "basic" : "standard";
}

/** tier null = a private plan (any handle other than Basic/Standard), e.g. a $0 plan given to one store. */
export type PlanState =
  | { kind: "ok"; tier: Tier | null }
  | { kind: "needs_plan" }
  | { kind: "wrong_plan" };

/**
 * What to do with a store, given its subscription (null = none) and Shopify plan.
 * `planAtStart` is the Shopify plan saved the first time we saw the subscription.
 */
export function planState(input: {
  subscribedHandle: string | null;
  basicHandle: string;
  standardHandle?: string;
  shopifyPlan: string | null;
  planAtStart: string | null;
}): PlanState {
  if (!input.subscribedHandle) return { kind: "needs_plan" };
  if (input.subscribedHandle === (input.standardHandle ?? "standard")) return { kind: "ok", tier: "standard" };
  // Private plans are set per store in the Partner Dashboard, so whatever they cost is what we agreed.
  if (input.subscribedHandle !== input.basicHandle) return { kind: "ok", tier: null };
  // On the $9 plan: fine if the store was on Basic/Starter when it subscribed (or is now).
  const startedOn = input.planAtStart ?? input.shopifyPlan;
  return tierForShopifyPlan(startedOn) === "basic" ? { kind: "ok", tier: "basic" } : { kind: "wrong_plan" };
}

/** Shopify's hosted plan page for this app. */
export function planPageUrl(shop: string, appHandle: string) {
  return `https://admin.shopify.com/store/${shop.replace(/\.myshopify\.com$/, "")}/charges/${appHandle}/pricing_plans`;
}

/** Comma/space separated list of shop domains that never pay. */
export function parseExempt(raw: string | undefined) {
  return new Set(
    (raw ?? "")
      .split(/[\s,]+/)
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  );
}
