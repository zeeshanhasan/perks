# TASKS — Tofo Perks

Legend: `[ ]` todo · `[~]` in progress · `[x]` done · 🧑 = needs Zeeshan (local machine or account)

## Phase 0: Setup ✅

- [x] Scaffold the React Router app (TypeScript) under the Tofoapp org
- [x] Repo `zeeshanhasan/perks`, initial push
- [x] Dev store `perks-frtekwck` with the app installed
- [x] Tunnel `dev-perks.tofoapp.com` (see decision 004)
- [x] Test products, collection and customers (see `docs/acceptance-tests.md`)

## Phase 1: Spike, prove the Functions (STOP if it fails)

- [ ] Remove the template demo code (product generator, demo metafield/metaobject, products webhook)
- [ ] Add scopes: customers, products, discounts, metafields
- [ ] Define the app-owned metafields: customer eligibility, product flags
- [ ] Discount Function reads the customer eligibility + product flags
- [ ] Validation Function blocks employee-only lines for ineligible buyers
- [ ] 🧑 Manually set the metafield on Zeeshan Employee, then test the discount and the block on the dev store
- [ ] Record the result in decision 003 → Accepted, or redesign

## Phase 2: Data + backend

- [ ] Prisma models: Shop, Employer, BenefitPolicy, EmployeeMembership, VerificationChallenge, AuditEvent, RateLimit
- [ ] Domain normalisation + exact-match check (with unit tests)
- [ ] Token create/consume: hashed, 30 minutes, single use, customer-bound (with unit tests)
- [ ] Rate limiter (with unit tests)
- [ ] Eligibility publisher: DB → customer metafield (set/clear)
- [ ] Email sender interface: console transport (dev) + Resend transport (prod)
- [ ] Audit log writer

## Phase 3: Storefront

- [ ] App proxy config `/apps/perks`
- [ ] HMAC verification middleware (with unit tests)
- [ ] `GET /verify`: Liquid page (logged-out → login prompt; logged-in → form/status)
- [ ] `POST /verify`: domain check, rate limit, send link
- [ ] `GET /verify/confirm?token=`: consume, grant, publish metafield
- [ ] Theme app extension: "Employee exclusive" badge block + verify link block

## Phase 4: Admin

- [ ] Settings page: employer name, domains, discount % (1–90), duration (1–24 months / none), combinations
- [ ] Products page: resource picker for employee-only + discount-excluded → product metafields
- [ ] Employees page: list, search, revoke, re-activate
- [ ] Audit log page
- [ ] Create/update the automatic app discount + validation on settings save

## Phase 5: Lifecycle + compliance

- [ ] Expiry sweep (cron) + dev trigger endpoint
- [ ] Uninstall cleanup
- [ ] Privacy webhooks: `customers/data_request`, `customers/redact`, `shop/redact`
- [ ] 🧑 Request protected customer data access (email) in the Partner dashboard

## Phase 6: Test + harden

- [ ] Vitest unit tests green
- [ ] 🧑 Run `docs/acceptance-tests.md` A–F on the dev store
- [ ] Fix defects
- [ ] 🧑 Fresh install on a second dev store (E1)

## Phase 7: Deploy + submit

- [ ] Adapt to Cloudflare Workers + D1 (decision 001; timebox half a day, else Fly.io)
- [ ] 🧑 Cloudflare API token, Resend + `mail.tofoapp.com` DNS
- [ ] 🧑 Workers route/custom domain `perks.tofoapp.com` (decision 004)
- [ ] Production app config (`shopify.app.production.toml`)
- [ ] Privacy policy page, listing copy, screenshots
- [ ] 🧑 Submit to the Shopify App Store
