# 007: Host on Railway for launch (supersedes 001 for now)

**Status:** Accepted · **Date:** 2026-11-03

- Railway runs the app unchanged: Node + SQLite on a volume, built from the `Dockerfile`, health check `/healthz`, 1 replica.
- The expiry sweep runs in-process every hour (`app/lib/cron.server.ts`). `/api/cron/expire` is kept for manual runs.
- Cloudflare stays the DNS: `perks.tofoapp.com` is a DNS-only CNAME to Railway, so the `*.tofoapp.com` Workers wildcard doesn't apply.
- About $5/month. Porting to Workers + D1 (decision 001) is optional later.
- Separate production Shopify app (`shopify.app.production.toml`). The `perks` app stays the dev app.
