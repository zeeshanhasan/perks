# App Store listing and submission

Updated 2026-11-16 for employee-perks-6. Copy these into the Partner Dashboard → App listing.

## Basics

- **App name:** Employee Perks
- **Pricing (decision 017):** Shopify App Pricing, two public plans, 30-day trial on both, every feature in both:
  - **Basic**, handle `basic`: $9/month or $90/year. Top features: "For stores on Shopify Basic or Starter", "Unlimited partner companies and employees", "Every feature included".
  - **Standard**, handle `standard`: $19/month or $190/year. Top features: "For Grow, Advanced and Plus", "Unlimited partner companies and employees", "Every feature included".
  - Welcome link: `/app`. Mark both plans free for partners and developers so reviewers can test.
  - Founding stores (first 50) keep their price for life: say so in the listing description.
- **App icon:** 1200×1200 PNG made from `public/brand/employee-perks-icon.svg`.
- **Category:** Selling products → Discounts (secondary: Customer accounts).

## Listing text

**Tagline (≤ 62 chars):** Employee discounts for partner companies, no codes

**Introduction (≤ 100 chars):** Give partner companies' employees their own prices and products. They log in with their work email.

**Description**

Run a corporate perks program without codes or spreadsheets. Add a partner company with its work email domain (like acme.com) and the discount its employees get. Employees log in to your store with their work email: Shopify's login code proves it's theirs, and their discount applies at checkout.

**Key features (≤ 80 chars each)**

1. Automatic discounts for customers logged in with a partner's work email
2. Employee prices in your theme and products only employees can buy
3. Monthly or yearly limits, invoices per company, and an activity log

**Feature list (detail)**

- **Many partner companies:** each with its own domains, percentage or fixed discount, products and collections.
- **Employee prices:** employees see their price on product pages and collections; other shoppers see the normal price.
- **Employee-only products:** hidden from other shoppers and blocked at checkout for anyone who isn't an employee.
- **Limits:** cap the discount or the spend per employee, every month or every year.
- **Reports and invoices:** what each company's employees bought, with a PDF invoice and an Excel file of every item.
- **Public perks page:** list partner companies and their discounts on your store.
- **Full control:** check any customer, remove perks instantly, every change logged.

## URLs and contacts

- Privacy policy: https://perks.tofoapp.com/privacy (the live page is the source; `privacy-policy.md` is an old draft)
- Terms of service: https://perks.tofoapp.com/terms (draft: review first)
- Website: https://perks.tofoapp.com
- Support email: hello@tofoapp.com (make sure it receives mail)
- Emergency developer contact: Zeeshan's email and phone (Partner Dashboard only)

## Protected customer data (Partner Dashboard → API access → Protected customer data)

Request Level 1 and these Level 2 fields, with these reasons:

- **Customer data (Level 1):** match a logged-in customer to a partner company and show the merchant who gets perks.
- **Email (Level 2):** the customer's account email domain decides which company's perks they get. Emails in the activity log are partly hidden.
- **Orders (read_orders):** count each employee's discount and spend for monthly/yearly limits, and build the per-company report and invoice. Only the last 60 days; no `read_all_orders`.
- Data retention: deleted on `customers/redact` and `shop/redact`; data requests answered from `customers/data_request`.

## Screenshots (1600×900, 3–6; no browser chrome or personal data)

1. Home: setup guide and the numbers
2. Edit business: domains, discount, limit (green summary)
3. Businesses list
4. Storefront: an employee price on a product page (theme)
5. Checkout: "Employee perks" discount applied
6. Reports: a company's invoice (PDF view)

## Demo screencast (required, 2–3 min, English or with English captions)

1. Install from the dev store, approve permissions, land on Home.
2. Add a business (domain, 15%, a monthly limit), turn on Employee mode from the Storefront page.
3. On the store: log in with a work-email account → employee price → checkout with the discount.
4. Log in with a personal email → normal price; an employee-only product is blocked at checkout.
5. Reports → Create invoice → PDF and Excel.

## Reviewer instructions (paste in "Testing instructions")

- The app needs **new customer accounts** (Settings → Customer accounts), so shoppers log in with a one-time code.
- After install: Businesses → Add business → name "Review Co", domain `<a domain whose mailbox you give the reviewer>`, 15%.
- Storefront page → Turn on Employee mode (opens the theme editor with the embed selected) → Save.
- Log in on the store with an email at that domain: products show the employee price; the discount applies at checkout.
- Log in with any other email: normal prices; employee-only products are hidden and blocked at checkout.
- Bogus Gateway is on for test orders.
- Give the reviewer a working inbox at the test domain (they need the login code), or a dev store with a test customer already set up.

## Billing setup (🧑, before submitting)

1. Partner Dashboard → app → Distribution → Manage listing → Pricing content → Settings → **Shopify App Pricing**. Create the two plans above.
2. Partner Dashboard → Settings → Partner API clients → create one with **Manage apps**. Put in Railway (never in code): `SHOPIFY_PARTNER_ORG_ID` (the number in the Partner Dashboard URL), `SHOPIFY_PARTNER_API_ACCESS_TOKEN`, `SHOPIFY_APP_GID` (`gid://shopify/App/<number in the app's Partner Dashboard URL>`).
3. Railway `BILLING_EXEMPT_SHOPS`: your own stores and the first client, comma separated (they never see the plan page).
4. Billing stays off until all three Partner API values are set. Then: open the app on the dev store → the plan page shows → pick a plan (free on dev stores) → back in the app, Settings shows the plan.

## Before submitting

- [ ] Landing page shows no store address box (done: "Get early access" until the listing is live, App Store rule 2.3.1)
- [ ] Run the automated checks in the Partner Dashboard
- [ ] Storefront speed: Lighthouse with and without the Employee mode embed (must not drop the score much)
- [ ] Protected customer data request approved
- [ ] When the listing is live: set `APP_STORE_URL` in `app/components/PublicLayout.tsx`
