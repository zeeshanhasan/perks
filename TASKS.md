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
- [x] 0.2 Billing (decision 017, 2026-11-17): Basic $9 / Standard $19 by Shopify plan, 30-day trial, Shopify App Pricing. Plan check in the app root (Partner API), wrong-plan page, Settings → Plan, hourly pause/resume of perks, exempt list. Off until the Partner API env vars are set
- [x] 0.2b Billing setup (2026-11-18): plans, `comped` private plan for the two PK stores, Partner API client, Railway vars. App handle is `tofo-perks` (Railway `SHOPIFY_APP_HANDLE` must be `tofo-perks` or unset)
- [x] 0.2c Fix: back from the plan page (`?plan_handle=`) the app re-checks the plan instead of using its 5-minute cache; hourly sweep skips uninstalled stores
- [ ] 0.2d Redesign the "Choose the Standard plan" page and Settings → Plan (plan cards, trial countdown, features); add a dev-only preview of both
- [ ] 🧑 0.2e Plan feature lines are cut at ~40 characters ("…and employee", "no cod"): shorten them in the listing's Pricing content (texts in `docs/app-store/listing.md`)
- [ ] 0.2f Set up `employee-perks-demo` as the public demo store (products, "Acme (demo)" on `gmail.com`, employee-only products, perks page, Employee mode) and link it from the site (`DEMO_STORE_URL`) and the listing
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
- [ ] G6 "exactly one discount": rerun now that the production app is uninstalled from the dev store (2026-11-13)

### Bugs found while testing (2026-11-10, not fixed yet)

- [x] Employee price shows twice on product pages on first load: the card pass now skips the product's own info area (2026-11-16). 🧑 check on a product page as an employee
- [x] Gift cards show an employee price: product page checks `product.gift_card?`, cards skip `gift_card`, and the storefront config lists gift card products as never discounted (2026-11-16). 🧑 check on the dev store
- [x] Dev and production apps on one store clash: solved for the dev store by uninstalling the production app there (2026-11-13). A real store only ever has one of them
- [x] A removed employee whose business was deleted can no longer be restored: Employees shows "Business deleted" instead of Restore, and the server refuses with a clear message (2026-11-16)
- [x] Small (2026-11-16): Enter runs Check a customer; personal domains (gmail.com) explain they can't be added and point to the verify link; fixes are buttons (Open Settings / Employees / Businesses / the business); wizard money is formatted; cards say "Staff price from …"; delete dialog opens in about a second

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
- [x] Home Help section (phase 1): How Employee Perks works, Ask Sidekick (launches with a prompt; out of the top bar), Ask Claude / ChatGPT / Gemini (new chat with a prompt pointing at the public guide `/llms.txt`, also `/ai-guide`)
- [x] 🧑 Checked by hand 2026-11-16: Ask Claude / ChatGPT / Gemini open a chat with the prompt (works)
- [x] AI guide rewritten (2026-11-16, `app/lib/ai-help.ts` → `AI_GUIDE`, served at `/llms.txt` and `/ai-guide`): how assistants should answer, words used, how employees qualify, first-time setup, every page with its real labels, limits with an example, fixes, privacy, what it doesn't do. Update it whenever a page changes
- [ ] Help phase 2: Sidekick app extension. A launched Sidekick chat can only use our app's own tools, it can't read `/llms.txt`, so: an `app-tools` extension with a `get_help_guide` tool that returns the same `AI_GUIDE` (one source) + `instructions.md`, then data tools (businesses, check a customer, this month's numbers) and action links. Needs `[sidekick] extensions_summary` in `shopify.app.toml`
- [ ] Help phase 3: remote MCP server for Claude/ChatGPT (new decision record first)
- [ ] 🧑 Check by hand: month picker on Home, limit dropdowns and a Bogus checkout that crosses a limit (both options), red Businesses badge
- [x] Edit business (done 2026-11-16): Active/Paused badge on the Business card (s-page has no badge slot) and a Status select (Active/Paused); limit periods say they restart ("Every month (starts again on the 1st)"); "Use up what's left of the limit" checkbox (ticked = partial) with a worked example; limit summary and Discounted products text in green; product picker: All / Only some products, Add products/collections buttons, vendor + type side by side, chosen items grouped by kind ("matches any of these"); Employee-only products always shown with a "How it works" box; Billing and "More options" removed (saved values kept, still print on invoices); Shopify sync warning banner with Retry; page shows first, vendor/type lists stream in; shorter delete dialog
- [ ] 🧑 Check by hand: limit dropdowns + "Use up what's left of the limit" checkbox, Retry banner (needs a failed sync)
- [ ] Test employee-only products on the dev store: non-employee blocked at checkout, employee can buy with discount, hidden from collections/search with Employee mode on, product page message
- [ ] Later: "Pause instead" in the delete dialog still needs Save
- [x] Add business wizard aligned with Edit business (2026-11-16): shared `app/components/BusinessFields.tsx` (discount fields + green line, limit fields with the restart wording, "Use up what's left" checkbox and green line, employee-only help); step names ("Step 2 of 3 · Discount"); fixed amount option; HR/billing email removed; step 3 = Discounted products (All / Only some) + optional "Make some products employee-only" with the help box; summary banner
- [ ] 🧑 Check by hand: go through the wizard and create a test business (the pane can't type into Polaris fields)
- [ ] Wizard, still open from the old list: errors on the field, add the typed domain on Next, number formatting, honest "Perks are live" toast, Cancel
- [x] Employees (2026-11-16): search + business + status filters in one row in the table's filter bar (selects apply straight away, search on Enter); pagination, 50 per page, with "Showing 1–50 of N"; help box moved to the bottom
- [ ] 🧑 Check by hand: Employees pagination with more than 50 (or test with a smaller page size)
- [x] Businesses list (2026-11-16): no sideways scroll (first domain + bold "+N" with the rest in a tooltip; "Some products" and "Monthly/Yearly" with details in tooltips, rendered outside the table so rows don't jump); whole row opens the business; help box moved below the table; cached shop info; error page with Retry; active first, then by name. Decided no: badge instead of the switch, red banner, search
- [ ] 🧑 Check by hand: list tooltips (+N, ⓘ), the Perks switch doesn't also open the business
- [ ] Later, if ever needed (new decision record first): re-verification of work-email logins. Email-link verification itself was removed in decision 016
- [x] Storefront (2026-11-16): Employee mode status row; "What employees see" / "What other shoppers see" with live previews; plain labels; wording behind "Edit wording"; Colours box removed
- [x] Perks page is its own page (`/app/perks-page`, in the app menu; Home row points there): switch + Live/Off badge, link with Copy/View, content, preview of listed companies, menu how-to; warning when the program is off
- [x] Reports (2026-11-16): period picker applies straight away, readable dates ("1–30 Nov 2026"), Home-style cards with ↑/↓ vs the period before, Create invoice dialog, invoices business filter + "N orders cancelled since it was issued", help at the bottom; shared `components/Metric.tsx`
- [x] Invoice redesign (2026-11-16): a document from the store to the partner company: INVOICE, invoice no., issue date, period, From (store name, address, email) and Bill to, a plain explanation of what's billed, a table per employee per month (email, month, orders, products, spend, discount, billed), totals and amount due. No customer IDs. "Download for Excel (every item)": one row per product line (employee email, month, order, date, product, variant, SKU, qty, unit price, line total, discount, paid, billed), UTF-8 for Excel. Orders now store their line items and email (migration `order_items_and_email`); new invoices freeze emails + items, and fill items for older orders from the Admin API (read_orders: last 60 days)
- [ ] 🧑 Check by hand: place a Bogus order as an employee, create an invoice, check the PDF and the Excel file. INV-202611-001 was issued before items existed, so it shows "—" for products
- [ ] Release note: the invoice shows employee work emails to the partner company; mention it in the privacy policy/help if needed
- [ ] 🧑 Check by hand: Create invoice dialog (needs an order in the period), custom date range, Storefront save + previews, Perks page Copy link
- [x] Perks page (public): uses the theme's page width, so it lines up with the header (the wide layout never applied before); View page opens a new tab
- [x] Check a customer reviewed (2026-11-16): fix buttons, expiry date, personal-email message, Enter, cached shop info, error page
- [x] Activity (2026-11-16): readable time in the shop time zone; who = Staff / partly hidden employee email / "Employee Perks (automatic)"; Result column removed (only Blocked/Failed show, as a badge); details say which employee/business/invoice, readable, cut at 60 characters with the rest on hover; 50 per page; help at the bottom
- [ ] Activity: staff names need online access tokens (Shopify's User API gives no name in the admin). Decide first: decision record
- [x] Settings cut to three (decision 015, 2026-11-16): Pause all perks, Never discounted, Combining (with examples). Work-email logins always get perks; link verifications last 12 months. Data migration `fixed_settings` sets both for every store
- [ ] Release (decision 015): each production store needs one sync for the change to reach Shopify (Settings → Save once, already a store step). Check first whether any production store had work-email perks off
- [x] Help rewritten (2026-11-16): follows the app's pages (Get started in 4 steps, How employees get perks, Businesses, Employees, Storefront and the Perks page, Reports and invoices, Settings, Common questions), with links into each page. Right column: Get help (Sidekick, Claude, ChatGPT, Gemini; shared `components/AskHelp.tsx` with Home), Feedback & feature requests (email buttons), Contact (hello@tofoapp.com, perks.tofoapp.com)
- [x] Support email is hello@tofoapp.com everywhere: Help, AI guide, landing page, privacy page, App Store listing and privacy policy (2026-11-16)
- [ ] 🧑 Make sure hello@tofoapp.com receives mail (and update the email in the Partner Dashboard listing when submitting)
- [x] Public site (2026-11-16): new landing page at perks.tofoapp.com (hero with an employee-price card, How it works, Features, Pricing, FAQ, "Already installed? Open the app"), shared header/footer (`components/PublicLayout.tsx`), privacy page restyled, new `/terms` page, SEO: title/description/canonical/social tags, `robots.txt` (only production is open; app, auth, api, webhooks, proxy closed), `sitemap.xml`. Embedded admin visits still go straight to the app
- [ ] 🧑 Terms of service is a DRAFT written from how the app works: have it reviewed (governing law not stated yet)
- [x] No pricing on the site (2026-11-16): pricing lives on the Shopify App Store listing. Terms still says the app is free while we launch; update it when billing (decision 009) starts
- [x] "Install on Shopify" on the site (2026-11-16): store address box in the hero and a closing navy band; accepts `acme`, `acme.myshopify.com` or the admin URL (`lib/shop-address.ts`), then Shopify's own login sends new stores to its install screen and installed ones to the app. Header button says Install on Shopify; phones get a second header row with the section links
- [x] Decided 2026-11-16: keep the Install box before approval (until then Shopify only lets development stores install; real stores get a Shopify error)
- [ ] When the App Store listing is live: set `APP_STORE_URL` in `components/PublicLayout.tsx` (buttons switch from "Get early access" to the listing, with utm_source); add privacy + terms URLs in the Partner Dashboard listing
- [x] Site restyled (2026-11-16): professional look in the mascot's colours used as accents (navy text and buttons, coral and sunflower highlights, teal for savings), Inter, thin borders, no cartoon styling. Hero shows a store product page with the staff price and the checkout line; line icons for features; mascot (`public/brand/employee-perks-icon.svg`) only as logo, favicon and share image
- [ ] Later: a 1200×630 share image, Google Search Console + submit the sitemap, analytics/ad tracking only when ads start (needs a cookie banner)
- [x] Decision 016 (2026-11-16): work-email login only. No email-link verification and no email sending (Resend not needed). /apps/perks/verify is a "my perks" status page (all set / log in with your work email / removed); /apps/perks/confirm redirects there. Older link-verified employees keep perks until their date. Texts updated in the app, Help, AI guide, landing FAQ, privacy page, App Store docs and the theme link block
- [ ] 🧑 Check the "Log in with your work email" page with a customer logged in with a personal email
- [ ] Reports in the shop time zone, Invoice: proposals in the first message of the 2026-11-10 session; redo them page by page
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

## Next (in order, from 2026-11-19)

1. 🧑 Fresh install walkthrough: new dev store + the production app (plan page included), Zeeshan gives UX feedback on onboarding and plan choice
2. Test the app from 0 to 100 (`docs/acceptance-tests.md`), reading the `[perks] timing` logs for slow pages
3. Fix the batch from 1–2 in one PR, including 0.2d (plan pages redesign)
4. Set up the demo store (0.2f), then record the screencast and take the 6 screenshots (1600×900, `docs/app-store/listing.md` §4); use them in the listing, on the website gallery and in the app setup
5. Website update: screenshots, SEO, the rest of the content
6. Finish the submission (`docs/app-store/listing.md` §9) and submit
7. MVS demo store: new dev store, CPL products from myvitaminstore-pk via CSV export/import (products only, no customers or orders)

Later: move Railway to a US region; Built for Shopify after launch; e2e test script.

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
