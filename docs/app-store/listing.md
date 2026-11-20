# App Store listing and submission

Updated 2026-11-19. Copy these into Partner Dashboard → Employee Perks → Distribution → Manage submission.
Written to Shopify's listing rules: no prices outside Pricing, no statistics or "the only/best", no reviews,
no Shopify logo in images, field lengths checked.

## 1. Basics

| Field | Value | Notes |
|---|---|---|
| App name (≤30) | **Employee Perks** (decided 2026-11-19) | Rule 4.1.2 prefers a brand first; if review asks, add a brand word then |
| App icon | `docs/app-store/assets/app-icon-1200.png` | 1200×1200, square corners (Shopify rounds them) |
| Languages | English | Only languages the app UI supports |
| Primary category | Discounts (Selling products) | |
| Search terms (5) | employee discount · staff discount · corporate discount · employee pricing · B2B discount | One idea per term |
| Sales channel requirement | **Merchant must have Online Store** | Employee prices and hiding products use a theme app embed |
| Integrations | none | Don't list Shopify itself |

**Name decision (2026-11-19):** keep **Employee Perks**, same as the app's TOML name. Accepted risk: review may ask for a
more distinctive, brand-first name (rule 4.1.2).

**Built for Shopify** (the checklist on the Distribution page) is an optional badge, not part of submission. It needs
50 net installs on paid plans, 5 reviews and a 4+ rating, plus admin speed (LCP < 2.5 s, CLS < 0.1, INP < 200 ms over
100+ calls). Revisit after launch; the server move (TASKS) helps the speed part.

## 2. Listing text

**App card subtitle (≤62):**
Give partner companies' employees their own prices and perks

**App introduction (≤100):**
Win corporate customers: partner employees get their discount automatically at checkout.

**App details (≤500):**
Employee Perks lets you run a corporate perks program without discount codes. Add a partner company with its work email domain and the discount its employees get. Employees log in with their work email, see their own price while they shop, and the discount applies at checkout. Keep some products for employees only, cap each employee's discount per month or year, and invoice each company for what its employees bought.

**Features (≤80 each):**
1. Automatic discount for customers logged in with a partner's work email
2. Many partner companies, each with its own discount and products
3. Employee prices shown on product pages and collections
4. Employee-only products, hidden from others and blocked at checkout
5. Monthly or yearly limits on each employee's discount or spend
6. Reports and invoices per company, as PDF and Excel
7. A perks page on your store listing your partner companies
8. Check any customer and see exactly why they do or don't get perks

## 3. Pricing (only here, never in images or text)

Shopify App Pricing (already set up):
- **Basic**, handle `basic`: $9/month or $90/year, 30-day trial. For Shopify Basic or Starter stores.
- **Standard**, handle `standard`: $19/month or $190/year, 30-day trial. For Grow, Advanced and Plus.
- Private `comped` plan for the two partner stores.
- Pricing info URL: https://perks.tofoapp.com/#pricing

Plan feature lines (≤40 characters each, or Shopify cuts them):
| Basic | Standard |
|---|---|
| For Shopify Basic or Starter stores | For Shopify Grow, Advanced and Plus |
| Unlimited companies and employees | (same) |
| Auto discount by work email, no codes | (same) |
| Employee prices shown in your theme | (same) |
| Monthly or yearly limits per employee | (same) |
| Employee-only products | (same) |
| Invoices per company (PDF + Excel) | (same) |

## 4. Media

**Screenshots (1600×900, 3–6, desktop, no pricing, no personal data, alt text for each):**
1. Home with the setup steps and overview. Alt: "Employee Perks home with setup steps and this month's employee orders"
2. Add a business: domains, discount, limit. Alt: "Adding a partner company with its email domain, discount and monthly limit"
3. A product page in the store showing the employee price. Alt: "Store product page showing an employee their own price"
4. Checkout with the employee discount line. Alt: "Checkout with the employee discount applied automatically"
5. Reports with an invoice for a company. Alt: "Invoice for a partner company with each employee's orders"
6. Check a customer. Alt: "Checking why a customer does or doesn't get employee perks"

**Feature media:** optional. A 2–3 minute promotional video, or a 1600×900 image with one clear message (no Shopify logo, no prices).

**Demo store URL:** https://employee-perks-demo.myshopify.com (password shown in the demo instructions).
Demo instructions: "Store password: XXXX. Browse as a shopper to see normal prices (employee-only products are hidden). To see the employee view, email hello@tofoapp.com and we'll add your company's email domain to the demo company, then log in with your work email."
(Personal email domains like gmail.com are never accepted as a work domain, decided 2026-11-19.)

## 5. Links and contacts

- Privacy policy: https://perks.tofoapp.com/privacy
- Terms of service: https://perks.tofoapp.com/terms (shown in Shopify's install screen)
- Website: https://perks.tofoapp.com
- FAQ: https://perks.tofoapp.com/#faq
- Support email: hello@tofoapp.com (make sure it receives mail)
- Emergency developer contact: done (Partner Dashboard)

## 6. Protected customer data (request access)

Tick only what the app uses. **Do not tick name, phone, address, geolocation, IP or browser data.**

| Data | Why |
|---|---|
| Customer data (Level 1) | Match a logged-in customer to a partner company and show the merchant who gets employee perks |
| Email (Level 2) | The account email's domain decides which company's perks the customer gets. Emails in the activity log are partly hidden |
| Orders (read_orders) | Count each employee's discount and spend for monthly/yearly limits, and build each company's report and invoice. Last 60 days only; no read_all_orders |

Also answer: data is used only to run the merchant's perks program; never sold or shared; processed by our host only;
encrypted in transit (HTTPS); deleted on `customers/redact` and `shop/redact` (48 hours after uninstall);
customers' data requests answered through `customers/data_request`. Access is limited to the developer.
(Check one thing before answering "encrypted at rest": whether Railway volumes are encrypted at rest.)

## 7. Testing instructions for reviewers (paste in "Testing instructions")

```
Employee Perks gives employees of partner companies an automatic discount when they log in with their work email.
A customer qualifies when their store account email is at a partner company's domain. Personal email domains
(gmail.com, outlook.com and similar) are never accepted, because anyone can create those addresses.

Please test on your own development store with the email address you can receive mail at (for example your
company address). New customer accounts send a login code to that address.

1. Install the app. Shopify's plan page opens: choose Standard (free on development stores). The app opens on Home.
2. Businesses → Add business: name "Review Co", type the domain of your email (e.g. yourcompany.com), press Enter,
   Next, 15% off, Next, "All products in the store", Create business.
3. Settings → switch "Employee perks" on → Save. (New installs start with perks off.)
4. Storefront → Turn on → Save in the theme editor (this switches on Employee mode).
5. Optional: Businesses → Review Co → Employee-only products → Add products → pick one → Save.
6. In the store, log in (new customer accounts) with your email and enter the login code.
   Product pages and collections show "Your employee price", and checkout shows "Employee price (15% off)".
7. Log out, or log in with another email: normal prices; the employee-only product is hidden from collections,
   its page shows "Only for partner employees", and adding it to the cart is refused.
8. As the employee, place a test order (Bogus Gateway, card number 1). Reports shows it under Review Co;
   Mark the order fulfilled in Shopify: the Monthly invoices list shows Review Co's invoice for this month with the
   amount due, and View, Excel and PDF.
9. Check a customer: type your email to see which company's perks apply and why.

If your email is a personal address, contact hello@tofoapp.com and we'll help you test.
Billing: Basic is for Shopify Basic/Starter stores; on other plans the app asks for Standard.
Support: hello@tofoapp.com
```

## 8. Demo screencast (required, English, 3–5 minutes, setup + every feature)

1. Install from the dev store → permissions → Shopify plan page → choose Standard → app Home.
2. Add business: name, domain, 15% discount, monthly limit; save. Show the green summary.
3. Settings: switch Employee perks on, Save.
4. Storefront: Turn on Employee mode in the theme editor, Save.
5. Employee-only product: Businesses → edit → Employee-only products → pick a product.
6. Store: log in with a work-domain email (login code) → employee price on a product → checkout shows "Employee price (15% off)".
7. Another email: normal price, employee-only product blocked at checkout.
8. Reports → Monthly invoices → View, PDF and Excel.
9. Check a customer, Activity log, Settings → Plan.

## 9. Before submitting

- [ ] App name decided (see 1)
- [ ] Plan feature lines shortened (see 3)
- [ ] Demo store set up and its password added to the demo instructions
- [ ] Screenshots and screencast uploaded
- [ ] Protected customer data request submitted (email only)
- [ ] App capabilities selected: Discounts, Online Store (theme app extension), Checkout (validation), Customer accounts
- [ ] Automated checks run (last; they expire after 30 days)
- [ ] AI self review: Mark as done (we ran it; the only failure was fixed)
- [ ] Submit for review
- [ ] After approval: set `APP_STORE_URL` and `DEMO_STORE_URL` in `app/components/PublicLayout.tsx`
