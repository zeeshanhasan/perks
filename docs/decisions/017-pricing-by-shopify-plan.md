# 017: Pricing by Shopify plan ($9 / $19), billing through Shopify App Pricing

**Status:** Accepted · **Date:** 2026-11-17 · **Replaces:** the pricing part of 009 ($10 flat)

## Decision

- **Two prices, every feature in both:**
  - **Basic** ($9/month, $90/year) for stores on Shopify's Basic or Starter plan.
  - **Standard** ($19/month, $190/year) for every other Shopify plan (Grow, Advanced, Plus).
- **30-day free trial** on both. Development stores are never charged (Shopify approves plans at no charge on them).
- **Upgrading Shopify keeps your price:** the plan is checked against the Shopify plan the store had when it first subscribed. A Basic store that later moves to Grow stays on $9.
- **Founding stores:** the first 50 paying stores keep their price for life, plus setup help on a call. A promise in the listing and on the site; nothing to build.
- **No Advanced/Plus price yet.** Add one for new stores once big stores use the app and we know what they cost in support.
- **Billing:** Shopify App Pricing (plans set in the Partner Dashboard; Shopify hosts the plan page). The app only checks the plan through the Partner API `activeSubscription` query and sends stores without one to the plan page.
- **Plan ends (cancelled, frozen, expired):** the hourly job pauses the employee discount and the storefront prices. The employee-only checkout rule stays on (it must never open those products to everyone). Everything turns back on when the store has a plan again.
- **Free or special prices for one store** (e.g. Zeeshan's boss's store): a **private plan** in the Partner Dashboard (e.g. handle `comped`, no subscription fee), assigned to that store. Any plan handle other than `basic`/`standard` is accepted as-is, and Settings shows it as "Private plan · Free". The store approves it once on Shopify's plan page.
- **Billing is off until the Partner API is set up** (`SHOPIFY_PARTNER_ORG_ID`, `SHOPIFY_PARTNER_API_ACCESS_TOKEN`, `SHOPIFY_APP_GID`). Stores in `BILLING_EXEMPT_SHOPS` are never asked to pay (Zeeshan's stores and the first client).

## Why

- Competitors' entry prices are $9–10 (Pimsical $9.79, EMPOWER $9, Corporate Employee Discount $10): $9 removes the "too expensive to try" barrier for small stores. $19 is comfortable for Grow stores and still cheaper than Pimsical's middle plan ($24.79), with more features.
- No features behind higher plans: paywalled features are a top complaint in neighbouring apps (research in `docs/PRD-v4.md`).
- 30 days, not 14: a store has to sign a company and see employees shop before the app proves itself.
- Shopify App Pricing is Shopify's default for new public apps; since April 2026 it sends no billing webhooks, so plan state comes from the Partner API.

## Consequences

- Partner Dashboard: switch to Shopify App Pricing and create the two plans (handles `basic` and `standard`, or set `PLAN_HANDLE_BASIC`).
- Partner API client with **Manage apps** permission; its token goes in Railway, never in code.
- Terms, the site, Help, the AI guide and the App Store listing show the new prices.
