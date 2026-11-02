# 003: App-owned metafields feed the Shopify Functions

**Status:** Proposed (confirm in the spike) · **Date:** 2026-11-02

## Context

Functions can't call our backend. Everything they need has to be in their input query.

## Decision

| Data | Where |
|---|---|
| Customer eligibility | Customer metafield `$app:perks.eligibility` (JSON: `{ "status": "active", "expiresAt": "YYYY-MM-DD", "v": 1 }`) |
| Employee-only flag | Product metafield `$app:perks.employee_only` (boolean) |
| Discount excluded | Product metafield `$app:perks.discount_excluded` (boolean) |
| Discount % | Discount config metafield on the automatic app discount |

- The DB is the source of truth. Metafields are a published copy.
- The app namespace (`$app:`) is used with no storefront access. Customers can't read or write it.
- Functions **fail closed**: a missing or invalid metafield means not eligible.
- Expiry has two layers:
  - The Function compares `expiresAt` against the shop's local date, if the input exposes it. Verify in the spike.
  - A cron sweep clears expired metafields.

## Consequences

- Product selection changes mean writing product metafields. Fine at this scale.
- If the spike shows a Function can't read customer metafields at the needed target, stop and redesign before building further.
