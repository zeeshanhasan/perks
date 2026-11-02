# TASKS — Tofo Perks

Legend: `[ ]` todo · `[x]` done · 🧑 = needs Zeeshan

## Done

- [x] Scaffold, repo, dev store, tunnel (decision 004)
- [x] Discount + validation Functions (fail closed)
- [x] Link verification flow (app proxy, hashed single-use tokens, rate limits)
- [x] Admin pages, privacy webhooks, expiry sweep
- [x] **Confirmed on the dev store:** settings save, discount created, checkout rule created, link verification, non-employee blocked
- [x] **Overnight v2:**
  - [x] Auto-eligibility by logged-in work email (decision 005)
  - [x] Revocation overrides domain match; revoked can't self-verify
  - [x] Three product lists: employee-only / discounted for employees / never discounted
  - [x] Employee mode theme embed: hides products for non-employees, badge for employees (decision 006)
  - [x] UI rewrite: setup guide with progress, native Polaris layout, save bars, page explainers, Help page, friendly Activity log
  - [x] Checkout rule created on first Settings save
  - [x] Employees: "joined by" column, find existing employees, remove/restore
  - [x] Theme-native storefront verify page with an "all set" state for work-email logins
  - [x] 96 tests, lint, typecheck, build, theme check green

## Next

- [ ] 🧑 Partner dashboard: protected customer data **Email** (Level 2)
- [ ] 🧑 Run `docs/runbooks/dev-testing.md` + acceptance tests A–F
- [ ] Fix defects from testing
- [ ] Demo seed script (vitamin products) for App Store screenshots
- [ ] Cloudflare Workers + D1 port, Workers Cron (decision 001)
- [ ] 🧑 Cloudflare token, Resend + `mail.tofoapp.com` DNS, `perks.tofoapp.com` route
- [ ] Production app config, privacy policy page, listing copy, screenshots
- [ ] 🧑 Submit to the App Store

## Known risks to check on the dev store

- Customer account email field: the code reads `customer.defaultEmailAddress.emailAddress` (Admin API) and `buyerIdentity.customer.email` (Functions). Needs Level 2 access.
- The app-embed deep link `activateAppId=<api key>/employee-mode` may just open the editor without auto-enabling. Then turn it on manually.
- Employee mode card hiding is tuned for Dawn-family themes.
- The validation Function also runs at the cart stage, so some themes show the block message on add-to-cart. Intended (fail closed).
