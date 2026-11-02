# App Store listing (draft)

**App name:** Tofo Perks: Employee Discounts

**Tagline (≤ 62 chars):** Employee discounts and private products for partner companies

**Introduction (≤ 100 chars):** Reward partner company employees with automatic discounts and employee-only products.

## Description

Offer corporate perks without codes or spreadsheets. Add a partner company's email domain. Its employees get your discount the moment they log in with their work email, and can buy products you reserve just for them.

- **Automatic eligibility:** customers logged in with an approved work email get perks instantly. Shopify's login code proves the email.
- **Personal-email employees:** they verify their work email once with a secure one-time link.
- **Employee-only products:** only employees can check out. Everyone else is stopped at checkout.
- **Flexible discounts:** choose the percentage, which products, exclusions and how it stacks.
- **Employee mode:** hides employee-only products from other shoppers in your theme.
- **Full control:** remove perks for anyone instantly, with every change logged.

## Key features (3)

1. Automatic perks for work-email logins
2. Employee-only products, protected at checkout
3. Remove access instantly, with an activity log

## Requirements / notes for review

- Uses Shopify Functions (discount + cart and checkout validation).
- Uses the app proxy at `/apps/perks/verify`.
- Protected customer data:
  - Level 1
  - Email (Level 2): read the customer's account email to check the employer domain
- Works with new customer accounts. On legacy accounts, merchants should turn off automatic eligibility.

## Screenshots plan (1600×900)

1. Home: setup guide
2. Settings: partner company + discount
3. Products: the three lists
4. Storefront: employee badge on a product
5. Checkout: employee price applied
6. Checkout: non-employee blocked message
7. Employees list

## Support

- Email: support@tofoapp.com
- Privacy policy: https://tofoapp.com/perks/privacy
