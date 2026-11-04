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
- [x] Railway deploy setup: Dockerfile, railway.json, /healthz, in-process expiry scheduler (decision 007)
- [x] /privacy page, landing page copy, production config script
- [ ] 🧑 Follow `docs/runbooks/deploy-railway.md` (production app, Railway, DNS, `shopify app deploy`)
- [ ] 🧑 Resend + `mail.tofoapp.com` DNS for real verification emails
- [ ] Screenshots + reviewer test instructions
- [ ] 🧑 Submit to the App Store

## v3: multiple businesses (branch `feat/multi-business`)

- [x] Businesses: many per store, multiple domains, % or fixed discount, per-business targeting (products / collections / vendors / types), employee-only per business, limits (month/year, discount/spend), billing details
- [x] Functions v2 with live targeting via input variables + limit check from usage metafield
- [x] Order webhooks → usage per business; Reports dashboard; invoices (discount or spend, any range, frozen, print/PDF + CSV)
- [x] Legacy single-employer data auto-migrates
- [ ] 🧑 Update Railway `SCOPES` (adds `read_orders`), merge, `shopify app deploy --config production`, accept permissions
- [ ] 🧑 Test on the dev store: two businesses, collection/vendor targeting, a limit, an order, then an invoice

## Known risks to check on the dev store

- Customer account email field: the code reads `customer.defaultEmailAddress.emailAddress` (Admin API) and `buyerIdentity.customer.email` (Functions). Needs Level 2 access.
- The app-embed deep link `activateAppId=<api key>/employee-mode` may just open the editor without auto-enabling. Then turn it on manually.
- Employee mode card hiding is tuned for Dawn-family themes.
- The validation Function also runs at the cart stage, so some themes show the block message on add-to-cart. Intended (fail closed).

## v4: Employee Perks (see `docs/PRD-v4.md`)

### Part 0: Foundations (branch `feat/foundations`)

- [x] 0.1 Rename to **Employee Perks** in config and app copy (handle stays `tofo-perks`)
- [ ] 🧑 0.1 Partner dashboard: confirm the name, then `shopify app deploy --config production`
- [ ] 0.2 Billing ($10 flat): later
- [x] 0.3 Save bar no longer sticks after Discard or leaving a page
- [x] 0.3 Stale URLs after an update go to the app home instead of a 404
- [x] 0.3 Removed `include_config_on_deploy` (dropped by the CLI)
- [x] 0.4 CI on every PR: lint, typecheck, tests, build
- [x] 0.4 `scripts/smoke.sh` post-deploy check
- [ ] 0.4 e2e script on the dev store (after local testing)

### Part 1: Easy setup (branch `feat/foundations`)

- [x] 1.1 "Add business" is a 3-step wizard: who → discount → products, with a plain-English summary
- [x] 1.2 Presets: partner company / your own staff (prefills your email domain); 10 / 15 / 20% or custom
- [x] 1.3 Sidebar: Home, Businesses, Employees, Reports, Settings. Activity and Help moved to Home, Settings and Employees links
- [x] 1.4 Business page: employee-only products, limits and billing tucked under "More options"
- [x] 1.5 Perk debugger: "Check a customer" explains why someone does or doesn't get perks, with the fix
- [x] 1.6 Uninstall-safe: no theme code or theme scope; Help explains what happens on uninstall
- [x] Public email domains (gmail.com etc.) can't be added to a business
- [ ] 🧑 Test on the dev store

### Employee price on the storefront

- [x] Product page: "Your employee price Rs 1,700 (15% off)", normal price crossed out, follows variant changes
- [x] Product cards (collections, search, home): employee price under the normal price
- [x] Only for logged-in employees with the Employee mode embed on; theme settings to turn off, change the label, or keep the normal price
- [x] Discounted product handles published for businesses that don't discount everything
- [ ] 🧑 Test on the dev store (Dawn): product page, variant switch, collection page, search
