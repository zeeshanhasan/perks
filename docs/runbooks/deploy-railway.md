# Runbook: deploy to Railway

Production: `https://perks.tofoapp.com`, Railway (Docker + SQLite on a volume), DNS on Cloudflare.

## A. One-time: production Shopify app (5 min, your Mac)

The current `perks` app stays your **dev** app (its URLs follow the tunnel). Production gets its own app.

```bash
cd ~/perks
shopify app config link
```

- Choose **"No, create it as a new app"**, name it `Tofo Perks`, and name the config **`production`**.
- That creates `shopify.app.production.toml`. Then fill it from our settings:

```bash
node scripts/make-prod-config.mjs https://perks.tofoapp.com
```

- Partner dashboard → **Tofo Perks** → **Client credentials**: copy the **Client ID** and **Client secret** for step B.
- Same app → **API access → Protected customer data:** select Level 1 + **Email** (reason: App functionality), same as the dev app.

## B. Railway (10 min, browser)

1. **New Project → Deploy from GitHub repo → `zeeshanhasan/perks`**, branch `feat/v1` (switch to `main` after merge).
2. The service builds from the `Dockerfile` (`railway.json` sets this up).
3. Service → **Settings → Volumes → Add volume**, mount path: `/data`.
4. Service → **Variables**:

| Name | Value |
|---|---|
| `DATABASE_URL` | `file:/data/perks.sqlite` |
| `SHOPIFY_API_KEY` | Client ID (step A) |
| `SHOPIFY_API_SECRET` | Client secret (step A) |
| `SHOPIFY_APP_URL` | `https://perks.tofoapp.com` |
| `SCOPES` | `read_customers,write_customers,read_products,write_products,read_discounts,write_discounts,read_validations,write_validations` |
| `CRON_SECRET` | any long random string (`openssl rand -hex 32`) |
| `RESEND_API_KEY` | from Resend (until set, verification links only appear in Railway logs) |
| `PERKS_EMAIL_FROM` | `Tofo Perks <perks@mail.tofoapp.com>` |

5. Service → **Settings → Networking → Custom domain:** `perks.tofoapp.com`. Railway shows a **CNAME target**.

## C. Cloudflare DNS (2 min)

**tofoapp.com → DNS → Add record:**
- Type `CNAME`, name `perks`, target = Railway's CNAME target
- **Proxy status: DNS only (grey cloud).** Traffic then skips Cloudflare entirely, so the `*.tofoapp.com/*` Workers wildcard can't hijack it, and Railway issues the SSL cert.

Touch nothing else in the zone (decision 004).

Check (takes a few minutes):

```bash
curl -s https://perks.tofoapp.com/healthz
```

It should print `ok`.

## D. Push the Shopify side (your Mac)

```bash
shopify app deploy --config production
```

This creates a version with the Functions, the theme embed, metafield definitions, webhooks and the app proxy, and releases it.

## E. Test on a dev store, then submit

1. Partner dashboard → Tofo Perks → **Test on development store** → pick `perks-frtekwck` (or a fresh one).
2. Run the quick path in `dev-testing.md` step 6 against production.
3. **Distribution → Public (App Store)**, then fill the listing from `docs/app-store/listing.md`. Privacy policy URL: `https://perks.tofoapp.com/privacy`.

## Operations

- **Logs:** Railway → service → Deployments → logs.
- **Backups:** Railway volume snapshots, or download `/data/perks.sqlite`.
- **Expiry job:** runs hourly inside the app. Manual run:
  `curl -X POST -H "Authorization: Bearer $CRON_SECRET" https://perks.tofoapp.com/api/cron/expire`
- **Rollback:** Railway → Deployments → previous deploy → Redeploy. Shopify side: Partner dashboard → Versions → release the previous version.
- **Keep 1 replica.** SQLite on one volume doesn't support multiple instances.
