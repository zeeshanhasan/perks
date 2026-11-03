# 003: App-owned metafields feed the Shopify Functions

**Status:** Implemented, pending dev-store check · **Date:** 2026-11-02

## Context

Functions can't call our backend. Everything they need has to be in their input query.

## Decision

| Data | Where |
|---|---|
| Customer eligibility | Customer metafield `$app.perks_eligibility` (JSON: `{ "v": 1, "status": "active", "expiresAt": "YYYY-MM-DD" or null }`) |
| Employee-only flag | Product metafield `$app.perks_employee_only` (boolean, storefront read for the theme badge) |
| Discount excluded | Product metafield `$app.perks_discount_excluded` (boolean) |
| Discount % + scope | Metafield `$app.perks_config` on the automatic app discount (`{ "v": 1, "percent": 15, "scope": "employee_only" }`) |

- The DB is the source of truth. Metafields are a published copy.
- Definitions are declared in `shopify.app.toml` under the reserved `$app` namespace. Customer eligibility has no storefront access.
- Functions **fail closed**: a missing or invalid metafield means not eligible.
- Expiry has two layers:
  - The Function compares `expiresAt` against `shop.localTime.date` (eligible while the date is strictly before `expiresAt`).
  - A cron sweep clears expired metafields.

## Consequences

- Product selection changes mean writing product metafields. Fine at this scale.
- If the spike shows a Function can't read customer metafields at the needed target, stop and redesign before building further.
