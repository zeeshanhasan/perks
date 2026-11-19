# Outage page and uptime alert (one-time setup, Zeeshan)

What already happens when the server is down: checkout discounts, employee prices and employee-only blocking keep
working (they run on Shopify); webhooks are retried by Shopify for up to 48 hours. What the merchant sees without
this setup: Cloudflare's 502/521 page inside the Shopify admin, and Shopify's proxy error on `/apps/perks`.

## 1. Branded outage page (Cloudflare Worker)

Code: `infra/cloudflare/outage-worker.js`. It only passes requests through, and replaces a failed or 502/503/504
answer with a short "briefly unavailable" page (503). `/healthz` and `/webhooks/*` keep a plain 503.

1. Cloudflare → Workers & Pages → Create → Worker → name `perks-outage` → paste the file → Deploy.
2. Worker → Settings → Domains & Routes → Add route: `perks.tofoapp.com/*`, zone `tofoapp.com`.
   Only this route (decision 004). Never `*.tofoapp.com/*`.
3. Check: `curl -sI https://perks.tofoapp.com/healthz` still returns 200.

Undo: delete the route; nothing else changes.

## 2. Uptime alert

Any monitor works (e.g. UptimeRobot or Better Stack, free tier):
- URL `https://perks.tofoapp.com/healthz`, every 1–5 minutes, expect HTTP 200.
- Alert by email to hello@tofoapp.com (and your phone if the service offers it).

## Not possible yet

A second Railway replica: the database is SQLite on one volume, so only one instance can run. Railway restarts
the app on failure (`railway.json`: `ON_FAILURE`, 5 retries).
