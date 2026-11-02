# 006: Employee mode theme embed (cosmetic hiding)

**Status:** Implemented, pending dev-store check · **Date:** 2026-11-02

## Context

On non-Plus plans Shopify has no per-customer catalogs. Merchants still expect employee-only products to be hidden from other shoppers.

## Decision

- App embed `employee-mode` (theme app extension, `target: body`). The merchant switches it on in the theme editor.
- Liquid computes eligibility server-side with the same rule as the Functions, reading:
  - `customer.metafields.app.perks_eligibility` (storefront read; Liquid only exposes the logged-in customer's own record)
  - `app.metafields.perks.storefront` (app-data metafield: enabled, autoDomain, domains, percent, employee-only handles)
- For non-employees:
  - product cards linking to employee-only products are hidden (handles shipped as SHA-256 hashes, not plain names)
  - the product page buy buttons are replaced by a notice
  - an optional employee collection's links are hidden
- Employees see an "Employee price" badge on discounted products.

## Consequences

- Cosmetic only. Direct URLs still render, and checkout (validation Function) is the real lock.
- Card hiding uses common theme selectors (Dawn family). Unusual themes may need selector tweaks.
- Handles are published when Products are saved. Renaming a product handle needs a re-save.
