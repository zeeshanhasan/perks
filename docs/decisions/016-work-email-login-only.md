# 016: Work-email login only; no email-link verification

**Status:** Accepted · **Date:** 2026-11-16 · Removes the email-link path from 002 and 005; follows 015

## Context

Customers could become employees two ways: by logging in to the store with a work email (Shopify's login code proves it), or by verifying a work email with a one-time link we emailed while shopping with a personal account. The second path needs an email service in production (Resend and `mail.tofoapp.com` DNS), and without one the app would print verification links, which are tokens, into the server log. Zeeshan: it isn't a real case. Employees can simply create their store account with their work email.

## Decision

- Employees qualify only by logging in with an email at a business's domain. The app never sends email.
- `/apps/perks/verify` stays as a "my perks" status page: all set (work email), not eligible (explains to log in with a work email), perks removed, or log in. It has no form.
- `/apps/perks/confirm` redirects to `/apps/perks/verify`.
- The sending code (`email.server.ts`), the request/confirm flow, the verification rate limits and token helpers are removed from use.
- Existing link-verified employees keep their perks until their expiry date, and the hourly sweep still expires them. Employees and Check a customer still label them "Email link".

## Consequences

- No email provider is needed before launch; Resend moves off the list.
- A customer whose store account uses a personal email doesn't get perks. Check a customer and the status page tell them to log in with their work email.
- The `VerificationChallenge` and `RateLimitHit` tables stay in the schema for now (no destructive migration); they're no longer written.
- Re-verification (the parked policy) would now mean re-checking work-email logins, if it's ever needed.
