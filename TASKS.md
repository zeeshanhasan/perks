# TASKS: Employee Perks

Legend: `[ ]` todo · `[x]` done · 🧑 = needs Zeeshan. Plan: `docs/PRD-v4.md`. Handoff: `docs/HANDOFF.md`.

## Shipped

- [x] v1: link verification, discount + checkout validation Functions, admin pages, privacy webhooks (PR #1)
- [x] v2: auto-eligibility by work email, Employee mode embed, UI rewrite (PR #1)
- [x] v3: multiple businesses, live targeting, limits, usage reports, invoices (PR #2, released as tofo-perks-3)

## v4 on branch `feat/foundations` (one PR)

### Part 0: Foundations

- [x] 0.1 Renamed to **Employee Perks** in config and copy (handle stays `tofo-perks`)
- [ ] 🧑 0.1 Partner dashboard: confirm the name is free
- [ ] 0.2 Billing ($10 flat, Managed Pricing, comped stores): not started (decision 009)
- [x] 0.3 Ghost save bar, 404 after updates, login page inside the admin, stray "$" (Cloudflare beacon + stream markers), `include_config_on_deploy`
- [x] 0.4 CI (lint, typecheck, tests, build) and `scripts/smoke.sh`
- [ ] 0.4 Automated e2e script on the dev store

### Part 1: Easy setup (decision 012)

- [x] 3-step Add business wizard with presets, limits and HR/billing email
- [x] Domain chips with instant checks; public email domains rejected
- [x] "Check a customer" perk debugger
- [x] Trimmed sidebar; More options on the business page
- [x] Safe delete (archive + impact modal), pause from the list (decision 010)
- [x] "Title must be unique" fix and resilient Shopify sync (decision 010)
- [x] Uninstall-safe audit

### Storefront (decision 011)

- [x] Employee price on product pages and product cards
- [x] Storefront page: embed status, editable texts and options
- [x] Theme guards: script under 10 KB, no braces inside `{{ }}`

### Verified on the dev store

- [x] Save bar, 404, "$", app title link, dev preview
- [x] Wizard, chips, delete modal, pause switch, Check a customer (G1–G5, H1–H3 on 2026-11-10)
- [x] Storefront page: status, Turn on, Check again, edit texts (I1–I2)
- [x] Employee price: product page, variant switch, collection, search (I3–I4; bugs below)
- [x] Collection targeting at checkout, order → Reports → invoice, cancel keeps the invoice (J1–J3)
- [ ] 🧑 J4 limit stops the discount, I5 guest view, K uninstall (not run yet)
- [ ] G6 "exactly one discount": the dev store also has the production app installed, so it shows two (see bugs)

### Bugs found while testing (2026-11-10, not fixed yet)

- [ ] Employee price shows twice on product pages on first load: the card-price pass also matches the main product price (`price-template--…__main`)
- [ ] Gift cards show an employee price, but Shopify never discounts gift cards
- [ ] Dev and production apps on one store clash: both embeds write `window.TofoPerks` (last one wins); both claim `/apps/perks`. (`embedEnabled` now matches only our app's block: fixed on `feat/page-fixes`)
- [ ] A removed membership whose business was deleted can be restored and shows "Active · Deleted business"
- [ ] Small: Enter doesn't run Check a customer; gmail.com hint says "Add this domain"; "Restore them on the Employees page" isn't a link; wizard summary "PKR 50000" has no comma; cards say "From Staff price…"; delete modal takes ~4 s to open

## Home redesign + new features on branch `feat/home-redesign` (one PR)

- [x] Home: top bar (Add business, Check a customer, Ask Sidekick when available), Overview with month picker, 4 cards with tooltips and ↑/↓ vs previous month, compact Manage list (green box and right column removed)
- [x] Perks page: public `/apps/perks` listing partner companies and discounts; switch, title, intro and domains option on the Storefront page (off by default)
- [x] Employee perks block on the Shopify customer page (`extensions/perks-customer-block`, API `/api/customer-perks/:id`): business, discount, limit used/left, orders and savings
- [ ] 🧑 Check by hand: tooltips, month picker, block's "Manage in Employee Perks" link, perks page on a store without the production app
- [ ] 🧑 App icon: upload a 1200×1200 icon for "perks" and "Employee Perks" in the Dev Dashboard
- [ ] Sidekick app extension (data tools + action intents) so Sidekick can answer about and set up this app

## Page fixes on branch `feat/page-fixes` (one PR, one page at a time)

Started 2026-11-10. Each page: propose fixes → Zeeshan's OK → fix → check on the dev store.

- [x] Home: active-only counts, Employees arrow compares active, months in the shop's time zone, Storefront badge counts only our embed (fixes the dev/prod clash for the badge), red Businesses badge when nobody gets perks, "Needs permission"/"Couldn't check", Perks page row jumps to its section, Employee spend card, grey Discount arrows, faster load (theme check streamed, shop info cached), error page with retry (`app/components/RouteError.tsx`)
- [x] Edit business: domain chips inside the field (bigger), separator above Active, Discount card (type + value side by side, green summary, limit inside the card: period row, then "Limit on" + amount, then "When an order goes past the limit")
- [x] Limit gives what's left, then stops; or "only items that fit in full" (decision 014, Function change, migration `limit_overflow`)
- [ ] 🧑 Check by hand: month picker on Home, limit dropdowns and a Bogus checkout that crosses a limit (both options), red Businesses badge
- [ ] Edit business, next: Discounted products, Employee-only products (explain them better), More options, billing; header status badge, summary at top, Shopify sync warning banner with Retry, faster loader, delete confirm (instant, wording), "Pause instead" pauses right away
- [ ] Add business wizard: step names, errors on the field, add typed domain on Next, placeholders as "e.g.", number formatting ("PKR 50000"), fixed amount option, honest "Perks are live" toast, Cancel, summary on every step, limit option
- [ ] Businesses list: 5 columns, whole row clickable, Active/Paused wording + badge, red banner when nobody gets perks, cached shop info, error page, search over 10
- [ ] Employees, Check a customer, Reports (shop time zone too), Invoice, Storefront, Settings, Help, Activity: proposals in the first message of the 2026-11-10 session; redo them page by page
- [ ] Every page: help banners come back on each visit (make them a subtitle), readable dates, `RouteError` on each route
- [ ] Release: `shopify app deploy --config production` is needed for the Function input change (decision 014)

## Release (🧑, see `docs/runbooks/deploy-railway.md` → Releasing an update)

employee-perks-5 (PR #3 + PR #4), 2026-11-10:

- [x] Railway `SCOPES` += `read_themes` **before** merging
- [x] Merge the PR → Railway deploys (migrations run on start)
- [x] `shopify app deploy --config production` (released as employee-perks-5)
- [x] `sh scripts/smoke.sh`
- [ ] Store steps: approve new permissions in each store
- [ ] Store steps: open Settings → Save once
- [ ] Store steps: open Storefront → check Employee mode is on
- [ ] Store steps: pin the Employee perks block on the customer page

## Next (in order)

1. 🧑 Resend + `mail.tofoapp.com` DNS so verification emails send in production
2. App Store submission: screenshots, reviewer instructions, demo store (free launch is fastest)
3. Billing ($10 flat)
4. e2e test script

## Parked

- Emails through Shopify Email / segments (PRD part 3; consent caveat)
- Medical allowance, verified claims model (decision 013)
- POS + QR perk card, partner request form + HR portal, verified communities, claim receipts (CA), gifting, salary deduction, growth (PRD parts 4–11)
- Odoo connector

## Known risks

- Employee price and card hiding are tuned for Dawn-style themes.
- Store credit (if used later) needs new customer accounts.
- Two orders placed within seconds can both use what's left of a limit (usage updates from webhooks; decision 014).
- Validation runs at the cart stage too; some themes show the block message on add-to-cart (intended, fail closed).
