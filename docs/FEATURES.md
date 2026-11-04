# Employee Perks: what the app does today

Public Shopify app by Tofo. Works on every plan (Functions in public apps run on Grow). Production: https://perks.tofoapp.com

## For the merchant (admin)

| Area | Features |
|---|---|
| **Home** | Setup checklist (auto-detects business, program, Employee mode), this month's orders, spend, discount and active employees, links to Check a customer, Help, Activity |
| **Businesses** | Many partner businesses, each with work email domains (chips, instant checks), % or fixed discount, discounted products (all / products / collections / vendors / types), employee-only products, limit per employee (month/year, on discount or spend), billing email and address. Add via 3-step wizard with presets (partner company, your own staff). Pause/resume switch on the list. Delete archives with an impact modal |
| **Employees** | Everyone who got perks (by work email or verified link), find existing employees, remove/restore perks, Check a customer |
| **Check a customer** | Type an email: step-by-step reason why they do or don't get perks, with the fix |
| **Reports** | Orders, employees, spend and discount per business for this week/month/year or any range; invoices on discount or spend, frozen when issued, print/PDF and CSV |
| **Storefront** | Employee mode status in the live theme, one-click turn on, employee price options and label, employee-only product hiding and its message |
| **Settings** | Program on/off, automatic perks by work email, verification link validity, products never discounted, combining with other discounts, links to Activity and Help |
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
