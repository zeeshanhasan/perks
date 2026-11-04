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
- [ ] 🧑 Wizard, chips, delete modal, pause switch, Check a customer
- [ ] 🧑 Storefront page: status, Turn on, Check again, edit texts
- [ ] 🧑 Employee price: product page, variant switch, collection, search
- [ ] 🧑 Core flows never tested on a store: collection targeting at checkout, order → Reports → invoice, limit stops the discount (`docs/acceptance-tests.md` G–K)

## Release (🧑, see `docs/runbooks/deploy-railway.md` → Releasing an update)

- [ ] Railway `SCOPES` += `read_themes` **before** merging
- [ ] Merge the PR → Railway deploys (migrations run on start)
- [ ] `shopify app deploy --config production`
- [ ] Approve new permissions in each store; open Settings → Save once; open Storefront → turn on Employee mode
- [ ] `sh scripts/smoke.sh`

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
- The order that crosses a limit still gets the discount (webhook timing).
- Validation runs at the cart stage too; some themes show the block message on add-to-cart (intended, fail closed).
