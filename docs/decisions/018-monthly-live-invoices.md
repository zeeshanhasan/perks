# 018: One live invoice per business per month

**Status:** Implemented · **Date:** 2026-11-20 · Replaces the invoice part of 008

## Context

Invoices were snapshots over any range, made by hand with "Create invoice". A cancelled order stayed on the
invoice (only flagged in the list), the same business and period could be invoiced twice, and an unfulfilled
order was billed as if delivered. Zeeshan's review of Reports (2026-11-20) asked for monthly invoices that stay
current, with the order status, and View / Excel / PDF from the list.

## Decision

- **One invoice per business per month**, numbered `INV-YYYYMM-NNN` by the invoice month, created
  automatically the first time Reports loads after the business has an order that month. Only the number is
  stored (`Invoice`: shop, businessId, month, number); amounts are worked out live from `OrderUsage`.
- **Live:** cancelled orders drop out; edits and refunds update the amounts (`orders/updated` webhook, same
  `read_orders` scope).
- **Due once fulfilled:** an order's billed amount counts toward "Amount due" when Shopify marks it fulfilled.
  Unfulfilled and partly fulfilled orders show as "In process". Status: This month (month not over), Waiting
  on orders (over, some not fulfilled), Ready to send (over, all fulfilled).
- **Bill for** is a business setting (`Business.billFor`: discount, default, or spend), no longer a choice per
  invoice.
- Orders recorded before fulfilment was tracked are looked up from Shopify (`displayFulfillmentStatus`) on
  the Reports page.
- Excel: one row per item with invoice, business, employee email, month, order, order status, vendor and
  product type (type looked up from Shopify on export).
- The old snapshot invoices (test data on dev stores) were deleted by the migration.

## Consequences

- New webhook topic `orders/updated`: needs `shopify app deploy` to reach stores. No scope change.
- An invoice already sent to a business can still change if an order is cancelled or refunded later. That's
  intended: the invoice shows what is actually owed. Sending is outside the app for now.
- Reports no longer repeats Home's number cards.
