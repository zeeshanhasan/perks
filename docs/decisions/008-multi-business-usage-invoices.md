# 008: Multiple businesses, live targeting, limits, usage and invoices

**Status:** Implemented, pending store check · **Date:** 2026-11-03

## Decision

- **Business** (many per shop) replaces the single Employer:
  - name, domains (one business per domain)
  - discount: percentage, or a fixed amount off each item
  - discounted targeting and employee-only targeting (products / collections / vendors / types; discounted can be "all products")
  - limit per employee: month or year, capped on discount received or on spend
  - billing details
- **Functions (config v2)** live in `$app.perks_config` on the discount and the validation, with collection ids passed as **input variables** (`$app.perks_vars`, `input_variables` in the extension toml):
  - Buyer → business: link verification (`businessId` in the eligibility metafield) or account-email domain. Revoked beats both.
  - The discount applies the buyer's business value to lines matching its discounted or employee-only targeting, minus store-wide exclusions.
  - The validation blocks lines that match another business's employee-only targeting. Lines flagged `perks_employee_only` (resolved product list, synced on save) are blocked for non-employees as defence in depth.
  - Limits come from the customer metafield `$app.perks_usage` (month/year totals per business), updated from order webhooks. The order that crosses the limit still gets the discount (webhook timing).
- **Usage:** `orders/create` and `orders/cancelled` webhooks (`read_orders` scope) record `OrderUsage` per business: spend = subtotal after discounts, discount = our allocations only.
- **Invoices:** any range (week, month, year, custom), billed on discount or spend. Issued invoices snapshot their order lines, so later cancellations don't change them. Print/PDF via the browser, plus CSV.
- **Legacy data** (Employer + BenefitPolicy) migrates into one Business on first load.

## Consequences

- New scope `read_orders`: merchants re-approve permissions, and Railway `SCOPES` must include it.
- Theme embed config v2: hides other businesses' employee-only products and badges your own discounted products.
- Max 5,000 resolved employee-only products for flags/hiding (live checkout targeting has no cap).
