# 005: Automatic eligibility by logged-in work email

**Status:** Implemented, pending dev-store check · **Date:** 2026-11-02

## Context

Zeeshan's call: an employee who logs in with `name@partner.com` should get perks immediately, with no verify step.

## Decision

- **Eligible** = logged-in customer AND not revoked AND (account email at an approved domain **or** an active link-verification).
- Only the **customer account email** counts, never the checkout contact email. Guests can type anything; logged-in users have proved the email with Shopify's login code (new customer accounts).
- Both Functions read `{ v, domains, autoDomain }` from their owner metafield (`$app.perks_config` on the discount and on the validation).
- **Revocation** writes `{ v: 1, status: "revoked" }` to the customer metafield, which beats a domain match. Revoked customers can't self-verify; the merchant restores them.
- The link-verification flow stays for employees shopping with a personal email.
- `autoDomain` setting (default on) lets a merchant require link verification for everyone.
- `customers/create|update` webhooks + a "Find existing employees" scan record domain members for the Employees list. The Functions decide eligibility live; the list is informational.

## Consequences

- Needs **protected customer data Level 2: Email** (Functions + webhooks read the email). Declare it in the Partner dashboard and justify it at App Store review.
- On stores still using **legacy (password) customer accounts**, the account email isn't verified at signup. The Help page tells merchants to use new customer accounts, or to turn auto-domain off.
- Domain members have no expiry: eligibility lasts while the email matches.
