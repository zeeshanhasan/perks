# 002: App proxy for storefront customer identity

**Status:** Implemented, pending dev-store check · **Date:** 2026-11-02

## Context

We must know which Shopify customer is verifying, without trusting the browser.

## Decision

The storefront verification page and its form posts go through the **Shopify app proxy**, at `/apps/perks/*`:
- Shopify signs every proxied request and includes `logged_in_customer_id`.
- The backend verifies the HMAC signature and takes the customer ID only from it.
- The page can return Liquid, so it renders inside the merchant's theme.
- The emailed link opens `/apps/perks/confirm?token=…`. A GET only shows a Confirm button, so email link scanners can't burn the token. The POST consumes it, and the token must match the **current** signed `logged_in_customer_id`.
- HMAC verification is done by `authenticate.public.appProxy` (`app/lib/proxy-auth.server.ts`).

## Alternatives

- Customer Account UI extension with a session token: good UX, but more moving parts. Revisit later.
- Storefront JavaScript posting the customer ID: rejected, it can be spoofed.

## Consequences

- The app proxy needs a public URL. Dev uses the `dev-perks.tofoapp.com` tunnel.
- Logged-out visitors are sent to log in.
