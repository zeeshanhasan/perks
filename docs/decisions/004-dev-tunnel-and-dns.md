# 004: Dev tunnel and tofoapp DNS rules

**Status:** Accepted · **Date:** 2026-11-02

## Context

The `tofoapp.com` zone hosts a live SaaS. A Workers route `*.tofoapp.com/*` → `tofo-storefront` catches every subdomain.

## Decision

- **Dev tunnel:**
  - named Cloudflare tunnel `perks-dev`
  - `dev-perks.tofoapp.com` → `localhost:3000`
  - excluded from the wildcard by a Workers route `dev-perks.tofoapp.com/*` → **None**
- Perks only uses these hostnames:
  - `dev-perks.tofoapp.com`
  - `perks.tofoapp.com`
  - `mail.tofoapp.com` (email sending)
- **Production** `perks.tofoapp.com` needs its own specific route or Worker custom domain, so the wildcard doesn't catch it.
- Any other change to the tofoapp zone needs explicit approval from Zeeshan.
- The SaaS should reserve the subdomains `perks`, `dev-perks` and `mail`.

## Dev routine

```bash
cloudflared tunnel run --protocol http2 --url http://localhost:3000 perks-dev
shopify app dev --tunnel-url https://dev-perks.tofoapp.com:3000
```
