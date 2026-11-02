# TASKS — Tofo Perks

Legend: `[ ]` todo · `[~]` in progress · `[x]` done · 🧑 = needs Zeeshan (local machine or account)

## Phase 0: Setup ✅

- [x] Scaffold the React Router app (TypeScript) under the Tofoapp org
- [x] Repo `zeeshanhasan/perks`, initial push
- [x] Dev store `perks-frtekwck` with the app installed
- [x] Tunnel `dev-perks.tofoapp.com` (see decision 004)
- [x] Test products, collection and customers (see `docs/acceptance-tests.md`)

## Phase 1: Functions

- [x] Remove the template demo code (product generator, demo metafield/metaobject, products webhook)
- [x] Add scopes: customers, products, discounts, validations
- [x] Define the app-owned metafields in `shopify.app.toml`
- [x] Discount Function (`extensions/perks-discount`): eligibility + product flags + config, fail closed
- [x] Validation Function (`extensions/perks-validation`): blocks employee-only lines for ineligible buyers
- [x] Unit tests for both Functions' logic
- [ ] 🧑 Verify on the dev store (runbook step 7: B + C tests), then mark decision 003 Accepted

## Phase 2: Data + backend ✅

- [x] Prisma models + migration: Employer, BenefitPolicy, EmployeeMembership, VerificationChallenge, AuditEvent, RateLimitHit
- [x] Domain normalisation + exact match (with tests)
- [x] Tokens: hashed, 30 minutes, single use, customer-bound, race-safe claim (with tests)
- [x] Rate limiter: per customer, per email, per shop (with tests)
- [x] Eligibility publisher: DB → customer metafield
- [x] Email: console transport (dev) + Resend (prod)
- [x] Audit log (masked emails, no tokens)
- [x] One work email can't be shared across customer accounts

## Phase 3: Storefront ✅

- [x] App proxy `/apps/perks` → `/proxy/*`, HMAC via `authenticate.public.appProxy`
- [x] `/apps/perks/verify`: logged-out / form / verified / expired / revoked states
- [x] `/apps/perks/confirm`: GET shows a Confirm button (scanner-safe), POST consumes the token
- [x] Theme app extension: Employee badge block + Employee perks link block

## Phase 4: Admin ✅

- [x] Home: setup checklist, stats, run expiry now
- [x] Settings: program on/off, employer, domains, discount % (1–90), scope, combinations, duration (1–24 months / none)
- [x] Products: resource picker for employee-only + excluded → product metafields
- [x] Employees: list, search, filter, revoke, reactivate
- [x] Audit log page
- [x] Settings save creates/updates the automatic discount + validation

## Phase 5: Lifecycle + compliance

- [x] Expiry sweep + `POST /api/cron/expire` (CRON_SECRET) + admin button
- [x] Privacy webhooks: `customers/data_request`, `customers/redact`, `shop/redact`
- [ ] 🧑 Request protected customer data access (runbook step 2)

## Phase 6: Test + harden

- [x] Vitest: 76 tests green (`npm test`)
- [x] Lint + typecheck + production build green
- [ ] 🧑 Run `docs/runbooks/dev-testing.md`, then acceptance tests A–F
- [ ] Fix defects
- [ ] 🧑 Fresh install on a second dev store (E1)

## Phase 7: Deploy + submit

- [ ] Adapt to Cloudflare Workers + D1 (decision 001; timebox half a day, else Fly.io)
- [ ] Workers Cron → `/api/cron/expire`
- [ ] 🧑 Cloudflare API token, Resend + `mail.tofoapp.com` DNS
- [ ] 🧑 Workers route/custom domain `perks.tofoapp.com` (decision 004)
- [ ] Production app config (`shopify.app.production.toml`)
- [ ] Privacy policy page, listing copy, screenshots
- [ ] 🧑 Submit to the Shopify App Store

## Known risks to check on the dev store

- The `read_validations`/`write_validations` scope names: confirm the CLI accepts them.
- Validation errors at the cart stage: some themes may silently fail add-to-cart for ineligible buyers. Acceptable (fail closed), but note the UX.
- The `return_url` on the login link with new customer accounts may not return to the verify page. Cosmetic.
- The Polaris web components form submit (checkboxes/selects) on the Settings page: verify the saved values round-trip.
