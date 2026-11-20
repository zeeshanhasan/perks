# Security incident response policy

Employee Perks (Tofoapp). Adopted 2026-11-20. Owner: Zeeshan Hasan (developer and incident lead).
Review once a year and after every incident.

## What counts as an incident

Anything that may have exposed, changed or lost merchant or customer data, or let someone act as a store or
customer they're not. For example:

- A leaked secret: Shopify API secret, Partner API token, session token, Railway or GitHub credentials.
- Someone reading or changing another store's data (a missing `shopId` scope, a forged app proxy request).
- Unauthorised access to Railway, GitHub, Cloudflare or the Partner Dashboard.
- The database file (`/data/perks.sqlite`) or a backup copied or lost.
- A bug that gives the wrong customers perks at checkout or reveals employee emails to the wrong people.

## Steps

1. **Contain (within 1 hour of noticing).**
   - Rotate whatever leaked: the Shopify API secret (Partner Dashboard → App → API credentials, then Railway
     `SHOPIFY_API_SECRET`), the Partner API token, Railway / GitHub / Cloudflare passwords and tokens.
   - If the app itself is the problem: pause perks for affected stores (`BenefitPolicy.enabled = false`, the Settings switch), or take the
     service offline in Railway. Functions fail closed, so checkout keeps blocking employee-only products.
   - Revoke sessions of affected stores (delete their `Session` rows; they re-authenticate on next open).
2. **Assess (within 24 hours).** Which stores, which customers, which data, from when to when. Sources: Railway
   request and deploy logs, the `AuditEvent` table (per-store activity log), GitHub and Railway account activity,
   Cloudflare logs.
3. **Notify (within 72 hours of confirming personal data was affected).**
   - Affected merchants, by the email on their Shopify store: what happened, what data, what we did, what they
     should do. Merchants notify their own customers where the law requires it.
   - Shopify, through the Partner Dashboard support / app security contact, when Shopify data or customers'
     protected data is involved.
   - Data protection authorities where the law requires it.
4. **Fix and recover.** Fix the cause, add a test that would have caught it, deploy. Restore data from a Railway
   volume snapshot if any was lost or damaged.
5. **Review (within 2 weeks).** Write a short note in `docs/incidents/YYYY-MM-DD-<name>.md`: timeline, cause,
   data affected, who was told and when, what changed so it can't happen again.

## Contacts

- Incident lead: Zeeshan Hasan, hello@tofoapp.com
- Hosting: Railway (support via dashboard)
- Shopify: Partner Dashboard → Help; emergency developer contact is set in the Partner Dashboard

## Prevention (already in place)

- Secrets only in `.env` (gitignored) and Railway variables; never in code, commits or logs.
- Request log prints paths only; raw tokens and work emails are never logged.
- Every database query is scoped by `shopId`; customer identity only from the verified app proxy signature.
- 2FA on Shopify Partner, GitHub, Railway and Cloudflare accounts.
