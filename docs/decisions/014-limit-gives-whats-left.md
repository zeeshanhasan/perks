# 014: A limit gives what's left, then stops

**Status:** Accepted · **Date:** 2026-11-10 · Changes the limit behaviour in 008

## Context

008 made limits all-or-nothing: below the limit the whole cart got the full discount (so the order that crossed the limit overshot it), at the limit nothing. Merchants expect the discount to stop exactly at the limit: 10% off with a limit of Rs 500 and a cart worth Rs 650 of discount should give Rs 500.

## Decision

The discount Function reads each line's price (`cost.subtotalAmount`, `quantity`) and the employee's usage, and gives the full discount line by line until the limit runs out. The line where it runs out gets only what's left, as a fixed amount on that line; later lines get nothing.

- Limit on discount received: the discount stops at the amount left.
- Limit on total spend: only the part of the cart that fits in the spend left is discounted. Only discounted lines count in the cart; the order's full subtotal is still recorded afterwards from the webhook.
- Limits are in the shop's currency; the amount left is converted with `presentmentCurrencyRate`.
- A line without a price stops the discount there (fail closed).
- Carts that fit inside the limit get the same single discount as before.

We did not add "whole order" discount types: a fixed amount off the order could make cheap products free.

## Consequences

- Usage still updates from order webhooks, so two orders placed within seconds can both use the same amount left. Rare and much smaller than the old overshoot.
- The Function input query changed: needs `shopify app deploy` to reach production.
