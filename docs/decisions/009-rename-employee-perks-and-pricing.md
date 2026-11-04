# 009: Rename to Employee Perks; $10 flat pricing

**Status:** Accepted (pricing not built yet) · **Date:** 2026-11-04

## Decision

- **Name:** "Employee Perks" (by Tofo). The App Store has no app with that name; competitors use "Staff/Employee Discount". The app handle stays `tofo-perks` so admin URLs don't break.
- **Positioning:** corporate partnerships, not a cheap staff discount. The merchant gains customers and B2B revenue through companies.
- **Pricing:** $10/month flat with everything included, $99/year, 14-day trial. Free on development stores. Billing only through Shopify Managed Pricing (no billing code).
- **Comped stores** (Zeeshan's stores and the first client): Managed Pricing private plan if the Partner dashboard offers one, otherwise a `COMPED_SHOPS` env var.

## Why

- Competitor research (Nov 2026): Pimsical from $9.79 (7 reviews), Corporate Employee Discount $10 (0 reviews), EMPOWER from $9 (0 reviews). Neighbouring apps get 1-star reviews for paywalled features; "everything for $10" answers that.

## Consequences

- Billing is part 0.2 in `docs/PRD-v4.md`, still open. Launching free first is allowed and speeds up App Store review.
