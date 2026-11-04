# PRD v4: Employee Perks

**Status:** Draft · **Owner:** Zeeshan · **Brand:** tofoapp · **Builds on:** `docs/PRD.md` (v1), decisions 001–008

## What we build (the parts)

Build in this order. Each part ships as its own branch + PR.

0. **Foundations**
   - 0.1 Rename the app to **Employee Perks** (handle stays `tofo-perks`)
   - 0.2 Billing: **$10/month flat, everything included**, $99/year, 14-day trial, comped stores
   - 0.3 Bug fixes: ghost save bar after Discard, friendly page instead of 404 after updates, drop `include_config_on_deploy`
   - 0.4 CI on every PR + e2e test script on the dev store
1. **Easy setup (UX rewrite)**
   - 1.1 60-second "Add business" wizard: name → domain → discount → done
   - 1.2 Presets: "Whole store 10%", "Own staff", "Pharmacy panel", "Students"
   - 1.3 Fewer pages: Home, Businesses, Reports, Settings
   - 1.4 Advanced options hidden by default (targeting, limits)
   - 1.5 Perk debugger: type an email, see exactly why someone gets perks or not
   - 1.6 Uninstall-safe audit: no theme code, nothing breaks when the app is removed
2. **Medical allowance / panel pharmacy**
   - 2.1 Allowance per employee (e.g. Rs 50,000/year), optional family cover
   - 2.2 Employee wallet: balance shown on the storefront and in their account
   - 2.3 Checkout: covered amount billed to employer, employee pays any remainder
   - 2.4 Allowed products only (medicines; vitamins if the company allows)
   - 2.5 Optional HR approval per order (email/WhatsApp link), prescription upload for Rx items
   - 2.6 Monthly itemized invoice to HR with NTN/STRN fields, payment terms, credit limit per company
3. **Email through the store's own tools**
   - 3.1 Customer tags (`perks:<business>`) and metafields for segments
   - 3.2 Ready-made segments + Shopify Email / Klaviyo templates (welcome, allowance reset, new drop)
   - 3.3 Flow triggers: employee joined, allowance reset, order needs approval
   - 3.4 Verification emails stay on our sender (Resend, `mail.tofoapp.com`)
4. **Own staff + POS**
   - 4.1 "Own staff" preset (merchant's own domain)
   - 4.2 Confirm discount + allowance work on Shopify POS
   - 4.3 Perk card: QR on the account page, WhatsApp-able image, printable office poster
   - 4.4 POS extension: cashier scans the QR, customer attached, perks applied
5. **Partner request form + HR portal**
   - 5.1 Storefront page "Offer perks to your employees": company, domain, headcount, contact
   - 5.2 Requests inbox in the app: approve with a preset in one click
   - 5.3 Auto email to HR with the employee link, poster and QR
   - 5.4 HR portal (no Shopify login): employees, leavers, approvals, balances, invoices
6. **Company-funded perks**
   - 6.1 Subsidy: store gives X%, company pays Y%, billed monthly
   - 6.2 General wellness allowance (non-medical)
7. **Verified communities**
   - 7.1 Students, doctors/nurses, teachers, government staff, alumni, gyms by email domain
   - 7.2 Domain lists per community (`.edu.pk`, `.gov.pk`, hospital domains)
8. **Benefits claim receipts (Canada first)**
   - 8.1 Itemized "claim-ready" receipt PDF emailed after each order, for LSA/HSA claims
   - 8.2 Later: US HSA/FSA via a partner (e.g. Truemed)
9. **Gifting budgets**
   - 9.1 Company buys a budget per employee (e.g. Eid Rs 5,000), employees pick, one invoice
10. **Salary deduction**
   - 10.1 Employee buys now, employer deducts from payroll and pays the store's invoice. Opt-in per business with a credit limit
11. **Growth**
   - 11.1 ROI dashboard per business: customers, orders, revenue
   - 11.2 Seasonal boosts ("Eid week: 25%"), scheduled
   - 11.3 Vertical presets: pharmacy, fashion, fitness, eyewear, kids, electronics, food
   - 11.4 "Powered by Employee Perks" on HR emails, posters and portal (viral loop)
   - 11.5 One review request after the first win
   - 11.6 Later: perks network, where employees see every store offering perks to their company

## Positioning

- Competitors sell a cheap "staff discount". We sell **corporate partnerships**: the merchant gets new customers and monthly B2B revenue through companies.
- One-liner: *"Employee perks, medical allowances and corporate billing. Everything for $10."*

## Users

| User | Wants |
|---|---|
| Merchant | Sign corporate clients, set up in a minute, get paid monthly, never touch HR admin |
| Company HR | Give staff perks or a medical allowance without receipts and reimbursements |
| Employee | Log in, see the perk or balance, buy, pay nothing or less |
| Community member | Prove they're a student/doctor/etc. and get the discount |

## Research summary (Nov 2026)

| App | Price | Reviews | Notes |
|---|---|---|---|
| Pimsical Staff Discount | from $9.79 | 7 (5.0) | Leader. Own staff, POS, limits per period. Used by Le Coq Sportif, Alpinestars, Heelys, Vlisco |
| Corporate Employee Discount (Mean3) | $10 | 0 | Work-email discount only |
| EMPOWER Employee Discount | from $9 | 0 | Mentions partner companies, HRMS |
| Secure Staff Discount | free | 0 | Targeted discounts + reports |

What merchants hate in neighbouring apps (Locksmith, B2B wholesale, Rewardify, member pricing):

- Leftover theme code after uninstall took stores down for days (6 reviews)
- "Hidden" products still bought by bots (3)
- Trial ended and locked all products (3)
- Features paywalled on higher plans (3)
- Customers randomly not recognised, prices not applied (3)
- Support missing, setup needs paid custom dev (8)

Every part above answers one of these. The real gaps nobody fills: partner companies, employer-paid allowances, corporate invoicing.

Supporting facts:

- Canadian Lifestyle/Personal Spending Account claim forms list vitamins and supplements; employees need an itemized receipt.
- SheerID (community verification) charges per verification or a commission. Domain verification covers many of the same groups for $10 flat.
- POS UI extensions have a Scanner API for camera and hardware QR scans.
- Shopify segment triggers can start marketing automations when a customer joins a segment.

## Part 2 detail: medical allowance

### Flow

1. HR (or the merchant) sets the allowance per business: amount, period (month/year), family cover, allowed products, approval on/off.
2. Employee logs in with their work email, sees "Rs 32,400 left".
3. Checkout:
   - cart within balance: employee pays Rs 0, order marked "Billed to <company>"
   - cart over balance: allowance covers part, employee pays the rest (card or COD)
4. If approval is on: HR gets a link, approves or rejects. Rx items need a prescription upload. Rejected orders are cancelled or paid by the employee.
5. Month end: one itemized invoice per company (employee, date, items, amount), with NTN/STRN, due date and terms.

### Build options (decide in a decision record before coding)

| Option | How | Good | Bad |
|---|---|---|---|
| A. Gift card wallet | Perks issues a Shopify gift card per employee with the allowance balance | Native balance, split payment, works online and on POS, works on Grow | Codes can be shared (mitigate: assign to customer, smaller monthly balances). Gift cards can't target product types natively |
| B. "Bill to employer" payment method | Manual payment method, shown only to eligible employees by a payment customization Function | Clean accounting, fits approvals | No split payment online. Plan support to confirm |
| C. 100% discount up to balance | Discount Function covers the allowance | Simple, product targeting already built | Revenue shows as discount, accounting is messy |

Recommendation to test first: **A for the wallet + our targeting check in the validation Function**, with B as the follow-up for approval-heavy companies.

### Rules

- Balance never goes negative. Concurrent orders are checked at checkout and reconciled on the order webhook.
- Cancelled or refunded orders restore the balance.
- Credit limit per company: new covered orders stop when unpaid invoices pass the limit.
- Prescriptions are stored privately, never logged, and deleted on the privacy webhooks.

## Pricing

- $10/month, everything included. $99/year. 14-day trial.
- Free on development stores.
- Comped stores (Zeeshan's two stores, the first client) through Managed Pricing private plans if available, otherwise a `COMPED_SHOPS` env var.
- Billing through Shopify only (Managed Pricing, no billing code).

## Non-goals (for now)

- Apple/Google Wallet passes (low use in PK; revisit for CA/US)
- HRMS integrations
- Per-customer catalogs (Plus only)
- Payroll integrations (part 10 is invoice-based only)

## Open questions

1. Medical allowance: gift card wallet (A) or bill-to-employer (B) first? Test both on the dev store.
2. Does the discount Function apply on POS for a logged-in customer? Test in part 4.2.
3. Can a Grow store use segment triggers with Shopify Email? Test in part 3.
4. Do Managed Pricing private plans exist for comped stores? Check the Partner dashboard.
5. Which FBR invoice fields do PK companies need? Ask the first client's finance team.
6. Is the name "Employee Perks" free in the Partner dashboard? Claim it in 0.1.

## Success

- Merchant: first business live in under 2 minutes, no support ticket
- First corporate medical-allowance client billed through Perks
- 30 App Store reviews in the first 6 months
