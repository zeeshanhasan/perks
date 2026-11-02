# Acceptance tests — Tofo Perks

Run every test on the dev store `perks-frtekwck.myshopify.com` before submission.

## Test data

### Customers

| Customer | Login email | Role |
|---|---|---|
| Zeeshan Employee | `zeeshanhasan+emp@gmail.com` | Verifies as an employee using `zeeshan@tofoapp.com` |
| Zeeshan Normal | `zeeshanhasan+normal@gmail.com` | Never eligible |

### Employer

- Approved domain: `tofoapp.com`

### Products

| Product | Role |
|---|---|
| Green Snowboard | Normal |
| The Multi-managed Snowboard | Normal |
| The Complete Snowboard | Normal (has variants) |
| The Collection Snowboard: Liquid | Employee-only |
| The Collection Snowboard: Oxygen | Employee-only |
| The Collection Snowboard: Hydrogen | Employee-only, **excluded from discount** |

### Collection

- `Hydrogen`: the employee collection (Liquid, Oxygen, Hydrogen)

### Settings

- Discount: 15% for the test run
- Eligibility: 12 months

## A. Verification

| # | Test | Expected |
|---|---|---|
| A1 | Logged-out visitor opens `/apps/perks/verify` | Asked to log in. No form. |
| A2 | Employee submits `zeeshan@tofoapp.com` | "Check your email." Link sent (console in dev). |
| A3 | Submits `zeeshan@tofoapp.co`, `zeeshan@tofoapp.com.evil.io`, `zeeshan@sub.tofoapp.com` or `zeeshan@TOFOAPP.COM ` | Look-alike domains rejected. Case and whitespace are normalised, so the uppercase one is accepted. |
| A4 | Clicks the link | Verified. Eligibility metafield set. Audit event written. |
| A5 | Clicks the same link again | "Link already used." No change. |
| A6 | Clicks a link older than 30 minutes | "Link expired." |
| A7 | Normal customer opens the employee's link | Rejected: wrong customer. Normal stays ineligible. |
| A8 | Submits 6 requests in an hour | 6th is rate-limited. |
| A9 | Verifies | The account email stays `zeeshanhasan+emp@gmail.com`. The work email is not stored in Shopify. |

## B. Discount

| # | Test | Expected |
|---|---|---|
| B1 | Eligible employee: Liquid in cart | 15% off |
| B2 | Eligible employee: Hydrogen in cart | No discount (excluded) |
| B3 | Eligible employee: Green Snowboard | No discount (not employee-only) |
| B4 | Normal customer: any product | No employee discount |
| B5 | Eligible employee + another discount code | Follows the combination policy |
| B6 | Merchant changes discount to 20% | Next cart shows 20% |

## C. Checkout enforcement

| # | Test | Expected |
|---|---|---|
| C1 | Normal customer adds Liquid via the product page | Checkout blocked with a clear message |
| C2 | Normal customer uses a direct cart link `/cart/<variant>:1` | Checkout blocked |
| C3 | Logged-out guest with Oxygen in cart | Checkout blocked: must log in and verify |
| C4 | Eligible employee | Checkout succeeds |
| C5 | Employee logs out mid-checkout | Blocked |

## D. Lifecycle

| # | Test | Expected |
|---|---|---|
| D1 | Merchant revokes the employee | Metafield cleared. Discount and access gone on the next cart. Audit event written. |
| D2 | Eligibility expires (test with a 1-minute override) | Same as D1, via the scheduled job |
| D3 | Revoked employee re-verifies | Eligible again |
| D4 | Merchant removes `tofoapp.com` from the domains | New verifications blocked. Existing members follow the policy (proposed: stay until expiry). |

## E. Install, privacy, isolation

| # | Test | Expected |
|---|---|---|
| E1 | Fresh install on a second dev store | Works. No manual DB edits. |
| E2 | Uninstall | Sessions removed. Data purged on `shop/redact`. |
| E3 | `customers/data_request` webhook | Returns the stored data for that customer |
| E4 | `customers/redact` webhook | Deletes that customer's membership, challenges and work email |
| E5 | Two shops installed | Neither can see the other's employees, settings or audit log |

## F. Storefront paths (cosmetic + enforcement)

| # | Test | Expected |
|---|---|---|
| F1 | Theme search for "Liquid" as Normal | May appear (known limitation). Checkout still blocked. |
| F2 | Direct product URL as Normal | "Employee exclusive" message. Checkout blocked. |
| F3 | Employee collection link as the employee | Shows the 3 products with the badge |
