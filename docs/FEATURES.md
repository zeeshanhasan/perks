# Employee Perks: what the app does today

Public Shopify app by Tofo. Works on every plan (Functions in public apps run on Grow). Production: https://perks.tofoapp.com

## For the merchant (admin)

| Area | Features |
|---|---|
| **Home** | Setup checklist (auto-detects business, program, Employee mode), this month's orders, spend, discount and active employees, Manage list, Help section (How it works, Ask Sidekick with a ready prompt, Ask Claude / ChatGPT / Gemini opening a new chat pointed at the public AI guide), links to Check a customer and Activity |
| **AI guide** | Public `/llms.txt` (plain text) and `/ai-guide` (browser): what the app does, every page, business settings, storefront, common problems. No store data |
| **Businesses** | Many partner businesses, each with work email domains (chips, instant checks), % or fixed discount, discounted products (all / products / collections / vendors / types), employee-only products (with a how-it-works box), limit per employee (every month/year, on discount or spend; uses up what's left, or only discounts items that fit in full), Active/Paused status. Add via a 3-step wizard (Who gets perks, Discount, Products) that uses the same fields as the edit page. List: one domain + "+N" tooltip, short columns with tooltips, whole row opens the business, pause/resume switch. Delete archives with an impact modal. Billing email/address hidden for now (kept, printed on invoices if set) |
| **Employees** | Everyone who got perks (by work email or verified link), search + business + status filters in one row, 50 per page with pagination, find existing employees, remove/restore perks, Check a customer |
| **Check a customer** | Type an email: step-by-step reason why they do or don't get perks, with the fix |
| **Reports** | Period picker (applies straight away, readable dates), four cards with ↑/↓ vs the period before, orders/employees/spend/discount per business; Create invoice dialog (bill discount or spend); invoices list with business filter and a note when an order was cancelled after issue; invoices frozen when issued, print/PDF and CSV |
| **Storefront** | Employee mode status row with one-click turn on; "What employees see" and "What other shoppers see", each with a live preview and wording behind "Edit wording" |
| **Perks page** | Own page: switch with Live/Off badge, page link (copy/view), title, intro, show domains, preview of the companies listed, how to add it to the store menu |
| **Settings** | Three store-wide settings (decision 015): pause all perks, products never discounted, combining with other discounts (with examples). Work-email logins always get perks; link verifications last 12 months |
| **Activity** | Audit log of every change and verification |
| **Help** | How it works, product lists, limits/reports/invoices, Employee mode, FAQ (incl. uninstall) |

## For employees (storefront)

- Log in with a work email: perks apply automatically (Shopify's login code proves the email).
- Shopping with a personal email: verify a work email at `/apps/perks/verify` (single-use link).
- Employee price on product pages and product cards; discount applied at checkout.
- Employee-only products visible and buyable only to their business.

## Protection

- Perks only for logged-in customers; guest checkout never gets them; checkout email is never trusted.
- Checkout validation blocks employee-only products for everyone else (fail closed), even with the theme embed off.
- Public email domains can't be added to a business. Removed employees stay blocked even if their domain matches.
- Customer identity only from the signed app proxy; tokens hashed; work emails never logged.
- Never edits theme code. Privacy webhooks and 48-hour data deletion on uninstall.

## Under the hood

- Shopify Functions (JS): discount (`cart.lines.discounts.generate.run`) and cart/checkout validation, config in `$app` metafields, collections via input variables.
- React Router app, Polaris web components, App Bridge, Prisma + SQLite on Railway.
- Order webhooks record usage per business; customer usage metafield feeds limits to the Functions.
- Theme app embed (`extensions/perks-theme`), under Shopify's 10 KB script limit.
