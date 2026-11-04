# 010: Deleting a business archives it; Shopify sync never fails a save

**Status:** Implemented · **Date:** 2026-11-04

## Decision

- **Delete = archive.** `Business.archivedAt` is set and `active` turned off. Archived businesses:
  - drop out of lists, lookups, Functions config and the storefront config at once
  - keep their name on recorded orders, reports and invoices ("Acme (deleted)" in Reports, only when they have orders in the range)
  - can't be restored from the UI
- Before deleting, a modal lists the impact: employees losing perks, orders already placed keep their discount, employee-only products become normal products, orders/reports/invoices kept. It offers **Pause instead**.
- **Pause/resume** from the Businesses list (switch per business).
- **Sync resilience:** business saves, deletes and pauses are written to the database first, then pushed to Shopify. A failed push is logged ("Updating Shopify failed" in Activity), shown as a warning toast, and retried on the next save. Pages never crash on a Shopify error.
- **Discount adoption:** when the stored discount id is missing, the app finds its own automatic discount by Function id and reuses it. If another discount already uses the title "Employee perks", it creates "Employee perks (2)". The discount id is saved right after creation.

## Why

- A hard delete of the last business let the legacy migration recreate it, and broke reports and invoices that referenced it.
- A lost discount id made every save fail with "Title must be unique for automatic discount".
