# 015: Fewer store-wide settings

**Status:** Accepted · **Date:** 2026-11-16 · Changes the Settings page from 005 (domain auto-eligibility) and the link expiry choice

## Context

Settings had five store-wide options. Zeeshan couldn't tell what two of them were for, and merchants won't either:

- "Automatically give perks to customers who log in with a work email." Turning it off adds no security: Shopify's login code already proves the customer owns the email. It only makes every employee also click the verification link, and causes "my employee doesn't get it" support questions.
- "Email-link verifications stay active for N months" (1–24 or never). Few merchants know what to choose, and it only covers employees who verified by link, not the ones who log in with a work email.

## Decision

Settings keeps three things: pause all perks (the master switch), products never discounted, and combining with other discounts.

- Perks by work-email login are always on (`autoDomain = true`).
- Email-link verifications last 12 months (`eligibilityMonths = 12`).
- The fields stay in the database and the Function config, so the Functions don't change and need no deploy. The Settings form always saves these values, and a data migration sets them for every existing store.

## Consequences

- A store that had work-email perks switched off starts giving perks to work-email logins once the app syncs (the next save, or the "open Settings → Save once" release step).
- Link verifications made from now on last 12 months. Existing ones keep the expiry date they already have.
- Re-verification comes back as one policy for all employees (reminder emails, "verify again" on the storefront, "Ask to re-verify"), in its own decision record.
