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

### Customers (add one)

| Customer | Login email | Role |
|---|---|---|
| Work Test | `zeeshan@tofoapp.com` | Eligible automatically by domain |

### Settings

- Discount: 15%, applies to "Products I choose"
- Auto-eligibility by work email: on
- Link verifications last: 12 months
- Add Green Snowboard or Multi-managed to "Discounted for employees" for B2

## A. Eligibility

| # | Test | Expected |
|---|---|---|
| A1 | Log in as a customer whose **account email** is `@tofoapp.com` | Eligible immediately: discount at checkout, can buy employee-only items. Employees list shows "Work-email login". |
| A2 | Guest checkout typing `zeeshan@tofoapp.com` as contact email | No discount, employee-only items blocked |
| A3 | Account email `x@tofoapp.co`, `x@tofoapp.com.evil.io` or `x@sub.tofoapp.com` | Not eligible |
| A4 | Personal-email customer (`zeeshanhasan+emp@gmail.com`) verifies `zeeshan@tofoapp.com` at `/apps/perks/verify` | Link in terminal, Confirm, then "You're verified" and eligible |
| A5 | Same link used twice / after 30 minutes / by another account | "Already used" / "Expired" / "Different account" |
| A6 | 6 verification requests in an hour | 6th is rate-limited |
| A7 | Visit `/apps/perks/verify` logged in with a `@tofoapp.com` account | "You're all set" (no form) |
| A8 | Settings: turn off "Automatically give perks…" | A1 customer loses perks; link-verified customers keep them |

## B. Discount (15%)

| # | Test | Expected |
|---|---|---|
| B1 | Eligible: employee-only product (Liquid) | 15% off, "Employee price (15% off)" |
| B2 | Eligible: a "Discounted for employees" product | 15% off |
| B3 | Eligible: a "Never discounted" product (Hydrogen) | Full price |
| B4 | Eligible: a product in no list (Green Snowboard) | Full price (unless scope = All products) |
| B5 | Not eligible (Normal Test, guest) | No employee discount anywhere |
| B6 | Change discount to 20% and save | Next cart shows 20% |
| B7 | Eligible + another discount code | Follows the "Combining" settings |

## C. Checkout protection

| # | Test | Expected |
|---|---|---|
| C1 | Normal Test adds Liquid | Blocked with the employee-only message |
| C2 | Normal Test uses a direct cart link `/cart/<variantId>:1` | Blocked |
| C3 | Guest with Oxygen | Blocked |
| C4 | Eligible employee | Checkout works |
| C5 | Anyone buying a "Discounted for employees" product | Allowed (full price if not eligible) |

## D. Lifecycle

| # | Test | Expected |
|---|---|---|
| D1 | Employees → Remove perks (on a work-email-login employee) | Immediately no discount and blocked, even though the email still matches |
| D2 | Removed customer opens `/apps/perks/verify` | "Perks removed" (can't re-verify) |
| D3 | Employees → Restore perks | Eligible again |
| D4 | Link-verified expiry: set `expiresAt` in the past (Prisma Studio), then Home → maintenance or `POST /api/cron/expire` | Status Expired, perks gone |
| D5 | Change a domain employee's email to Gmail in Shopify admin | Employees list shows "Not eligible" (webhook); no perks |
| D6 | Employees → "Find existing employees" | Existing `@tofoapp.com` customers appear |

## E. Install, privacy, isolation

| # | Test | Expected |
|---|---|---|
| E1 | Fresh install on a second dev store | Works. No manual DB edits. |
| E2 | Uninstall | Discount and rule stop. Data purged on `shop/redact`. |
| E3 | `customers/data_request` | Logged in Activity |
| E4 | `customers/redact` | That customer's membership/challenges deleted |
| E5 | Two shops | No data shared |

## F. Employee mode (theme embed on)

| # | Test | Expected |
|---|---|---|
| F1 | Non-employee browses the collection / search | Employee-only products not shown |
| F2 | Non-employee opens an employee-only product URL | Buy buttons replaced by "Employee exclusive" notice |
| F3 | Employee opens a discounted product | Green "Employee price: 15% off at checkout" badge |
| F4 | Employee collection set in the embed | Its menu links hidden for non-employees |
| F5 | Embed off | Everything visible again; checkout still protected |

## G. Setup wizard and businesses (v4)

1. Businesses → Add business → "A partner company". Type `gmail.com` + Enter → rejected. Type a domain used by another business → rejected. Type `hr@acme-test.com` → chip `@acme-test.com`.
2. Step 2: 15%, limit Rs 5,000 discount per month. Step 3: some products → pick a collection. The summary sentence matches. Create → "Business created. Perks are live."
3. "Your own staff" preset: name = store name.
4. Businesses list: switch a business off → toast, Activity shows "Business paused". Switch back on.
5. Open a business → Delete → modal lists impact → Delete. It's gone from the list; Reports still shows its orders as "(deleted)".
6. Shopify Discounts: exactly one "Employee perks" from this app.

## H. Check a customer

1. Home → Check a customer → `zeeshan@tofoapp.com` → "Gets perks from TOFO".
2. `zeeshanhasan+normal@gmail.com` → "gmail.com isn't on any business".
3. Remove perks for an employee on Employees → check again → "You removed this customer's perks".

## I. Storefront page and employee price

1. Storefront → status banner. Turn on Employee mode → Save in the theme editor → Check again → "Employee mode is on".
2. Change the price label → Save.
3. Log in as `zeeshan@tofoapp.com`. A discounted product page shows "<label> Rs X (15% off)" with the normal price crossed out. Switching variants updates it.
4. A collection page and search results show the employee price on discounted products only.
5. Log out: normal prices; employee-only products hidden; an employee-only product page shows the notice.

## J. Core flows on the store

1. Collection-targeted business: an employee gets the discount at checkout only on that collection's products.
2. Place a test order as an employee → Reports shows it under the business this month.
3. Create an invoice (discount basis) → PDF/print and CSV work; cancel the order → the issued invoice doesn't change.
4. Set a low monthly limit → after crossing it, the next order has no employee discount.

## K. Uninstall

1. Uninstall the dev app → storefront shows no app markup; checkout no longer blocks employee-only products.
