# 001: Cloudflare Workers + D1 instead of PostgreSQL

**Status:** Accepted · **Date:** 2026-11-02

## Context

The brief proposed PostgreSQL + Prisma. tofoapp already runs on Cloudflare, and the Employee Benefits data is small and simple: shops, employers, memberships, tokens, audit events.

## Decision

- **Production:** Cloudflare Workers + D1. Prisma uses the D1 driver adapter.
- **Local dev:** the template's SQLite file. Same Prisma schema (`provider = "sqlite"`).
- **Scheduled jobs:** expiry sweeps run on Workers Cron Triggers.

## Consequences

- One vendor, one bill, no Hyperdrive.
- No interactive transactions on D1. Use batched writes plus idempotent operations instead.
- 10GB per database is plenty for v1.
- The template runs on Node, so it needs adapting to Workers. **Risk:** if the Workers adapter fights us, fall back to Fly.io + SQLite/LiteFS or Postgres. Timebox the attempt to half a day.
- The Odoo connector decides its own datastore later; it might need Postgres for locks and queues.
