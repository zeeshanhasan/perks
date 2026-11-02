# PRD — Tofo Perks (Employee Benefits app)

**Status:** Draft v1 · **Owner:** Zeeshan · **Brand:** tofoapp · **Distribution:** Public Shopify app

## 1. Problem

A partner employer wants its staff to get benefits at our Shopify stores:
- access to an extra, employee-only product catalog
- a discount on eligible products

Today there's no way to verify who is an employee, and nothing stops a non-employee from buying the employee catalog.

## 2. Goal

Verified employees can find and buy employee-only products at the agreed discount. Everyone else can't buy them.

## 3. Users

| User | Wants |
|---|---|
| **Merchant** (store admin) | Configure the employer, discount and products. Approve or revoke employees. See an audit history. |
| **Employee** (store customer) | Prove employment once, then shop the perks |
| **Non-employee customer** | Never sees an entitlement. Can't check out employee-only items. |

## 4. v1 scope

- One employer per shop, with one or more approved email domains (exact match)
- Work-email verification, bound to the logged-in Shopify customer
- Eligibility with an expiry, manual revocation, and re-verification after expiry
- Merchant picks the **employee-only products** and the **discount exclusions**
- One percentage discount, set by the merchant (1–90%, default 10%). It applies to employee-only products, or optionally to all products; exclusions always win.
- Eligibility duration set by the merchant (1–24 months or "no expiry", default 12 months)
- Discount combination policy set explicitly by the merchant
- Discount Function, plus a cart/checkout validation Function
- Theme app extension:
  - verification page
  - "Employee exclusive" messaging
  - employee collection link
- Admin pages: Settings, Products, Employees, Audit log
- Install and uninstall, plus the mandatory privacy webhooks

## 5. Out of scope (v1)

- Corporate SSO, HR/roster integrations, family accounts
- Spending allowances, POS, headless storefronts, subscriptions
- Advanced reporting
- More than one employer per shop
- Hiding employee-only products from theme search or direct URLs. Visibility in the theme is cosmetic; the validation Function is the real enforcement.

## 6. Employee journey

1. Customer logs into their Shopify customer account.
2. Opens `/apps/perks/verify`, the storefront page served through the app proxy.
3. Enters their work email.
4. Backend checks the domain (exact match) and rate limits, then emails a single-use link. In dev, the link is printed to the console.
5. Customer clicks the link while still logged in as the **same** customer.
6. Backend marks them eligible and writes the eligibility metafield to the customer.
7. The customer sees the employee collection. The discount applies at checkout.
8. When eligibility expires or is revoked, the metafield is cleared and the entitlement is gone.

## 7. Merchant journey

1. Install the app, then enable the theme app embed/blocks.
2. **Settings:** employer name, approved domains, discount %, eligibility duration, combination policy.
3. **Products:** pick employee-only products, and pick discount-excluded products.
4. **Employees:** list, search, revoke, re-activate.
5. **Audit log:** who did what and when.

## 8. Key rules

- Customer identity comes **only** from Shopify-signed context (the app proxy signature with `logged_in_customer_id`). Never from browser input.
- Work email:
  - stored privately in our DB
  - never written to Shopify
  - never replaces the customer's account email
- Tokens:
  - 32 random bytes, stored only as a SHA-256 hash
  - expire after 30 minutes, single use
  - bound to the shop, customer and email
- Rate limits:
  - per customer: 5 requests/hour
  - per work email: 3 requests/hour
  - per shop: a global cap
- Fail closed: if eligibility is missing, malformed or expired, there's no discount and checkout is blocked for employee-only items.
- Every row is scoped by `shopId`. Shops never see each other's data.

## 9. Success = acceptance tests pass

See `docs/acceptance-tests.md`.

## 10. Launch gates

1. All acceptance tests pass on the dev store.
2. A fresh install works without manual DB edits.
3. App Store submission is accepted. Live Grow stores need the **public** app, because Functions don't run there from a custom app.
4. Pilot with test employees, then the full employer.

## 11. Open questions

- [ ] Discount combinations: default to "combines with nothing"? (Proposed: yes; the merchant can change it.)
- [ ] When eligibility expires: hard-cut at the expiry date, or a grace period? (Proposed: hard-cut, with a re-verify email 14 days before.)
- [ ] App Store pricing: free vs. $19–49/month? Decide before submission.
