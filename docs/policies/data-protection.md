# Data protection practices

Employee Perks (Tofoapp). Written 2026-11-20 to back the answers in Shopify's protected customer data form
(Partner Dashboard → API access → Protected customer data access). Keep this file true: if a practice changes,
update it and the form together.

## Data the app uses

- Level 1: customer IDs, and orders from the last 60 days (`read_orders`, no `read_all_orders`) to count each
  employee's discount and spend against limits and to build invoices.
- Level 2: **email only**. The domain of a logged-in customer's account email decides which partner company's
  perks they get. Not requested: name, phone, address.
- Customer identity comes only from Shopify's signed app proxy request (decision 002).

## Purpose and minimisation

Data is used only to run the merchant's perks program: decide who gets perks, enforce limits, show the merchant
who has perks, and build per-company reports and invoices. No analytics, marketing, profiling or sale of data.
Customers' consent and sale opt-out choices are respected because nothing is used for marketing or sold.
The perks decision (a discount) has no legal or similarly significant effect.

## Merchant agreement

Merchants accept the Terms of service on install (https://perks.tofoapp.com/terms, section "Data processing"),
which make the merchant the controller and Tofoapp the processor and link the privacy policy
(https://perks.tofoapp.com/privacy).

## Retention

- `customers/redact`: that customer's membership, verification requests and rate-limit rows are deleted; their
  order records keep only the amounts (customer ID and email removed) so the merchant's invoice totals stay right
  (`redactCustomer` in `app/lib/membership.server.ts`).
- `shop/redact` (48 hours after uninstall): all of the store's data is deleted (`redactShop`).
- `customers/data_request`: answered from what we hold for that customer.
- Order usage covers the current limit periods; invoices are kept while the app is installed, because they are
  the merchant's billing records.

## Storage and encryption

- In transit: HTTPS only (Railway and Cloudflare TLS); Shopify API calls over HTTPS.
- At rest: SQLite on a Railway volume. Railway encrypts volumes and their snapshots at rest.
- Backups: Railway volume snapshots (same encryption). No copies on personal machines.
- Test and production are separate: separate Shopify app (`perks-5` vs `tofo-perks`), separate dev stores,
  separate database (`dev.sqlite` locally vs `/data/perks.sqlite` on Railway). Production data is never copied to
  development.
- Data loss prevention: volume snapshots; secrets only in Railway variables and a gitignored `.env`; nothing
  personal in logs or the repo.

## Access

- Only the developer (Zeeshan Hasan) can reach production data (Railway, Partner Dashboard). No other staff.
- Accounts with access use strong unique passwords and 2FA: Shopify Partner, Railway, GitHub, Cloudflare.

## Logging

- **In the app:** every action on a store's perks data is written to the `AuditEvent` table with who did it
  (customer, merchant staff or the system), what, when and the result. Merchants see it in the app's Activity page.
  Emails in it are partly hidden.
- **On the server:** Railway keeps request logs (paths only, never tokens or emails) and deploy logs.
- **On the accounts:** Railway, GitHub and Shopify Partner keep their own sign-in and activity logs, which show
  who reached production systems.

## Incidents

See `docs/policies/incident-response.md`.
