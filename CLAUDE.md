@AGENTS.md

# Tofo Perks: project rules

Employee Benefits Shopify app (public). Brand: tofoapp.

## Read first

- `docs/PRD.md`: what we're building and why
- `docs/acceptance-tests.md`: the definition of done
- `docs/decisions/`: decisions already made. Don't re-litigate; add a new record to change one.
- `TASKS.md`: current plan. Update the checkboxes as work lands.

## Stack

- Shopify React Router template, TypeScript, Polaris web components, App Bridge
- GraphQL Admin API, with the version pinned in `shopify.app.toml`
- Prisma: SQLite via `DATABASE_URL` (local `file:./dev.sqlite`; Railway `file:/data/perks.sqlite`). Hosting: Railway (decision 007)
- Shopify Functions in JavaScript/TypeScript for v1
- Theme app extension: Liquid, CSS, minimal JS
- Tests: Vitest (unit); acceptance tests by hand on the dev store

## Hard rules

- Customer identity only from the verified app proxy signature (decision 002). Never trust browser-sent IDs or flags.
- Never store or log raw tokens or work emails in logs.
- Every DB query is scoped by `shopId`.
- Functions fail closed.
- No secrets in code, commits, prompts or chat. Use `.env` (gitignored).
- Don't touch the tofoapp DNS or Workers routes beyond decision 004.
- Work on feature branches. Never push to `main` without Zeeshan's OK.

## Dev routine

```bash
cloudflared tunnel run --protocol http2 --url http://localhost:3000 perks-dev
shopify app dev --tunnel-url https://dev-perks.tofoapp.com:3000
```

- `.env` must contain `DATABASE_URL="file:./dev.sqlite"`
- Dev store: `perks-frtekwck.myshopify.com`
- Deploy: `docs/runbooks/deploy-railway.md`
- In dev, verification emails print to the console instead of sending.
