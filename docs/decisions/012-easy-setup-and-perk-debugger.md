# 012: Easy setup wizard, presets and the perk debugger

**Status:** Implemented · **Date:** 2026-11-04

## Decision

- **Add business** is a 3-step wizard: who (partner company or your own staff), what (10/15/20% or custom, optional limit per employee), which products (all, some, employee-only). A plain-English summary shows before Create. Limits, billing address and a second product list stay on the business page under "More options".
- **Own staff preset:** name = store name; domain = the store's email domain unless it's a public provider.
- **Work email domains** are chips, checked as they're typed: valid domain, not a public email provider (gmail.com etc. are rejected server-side too), not used by another business. A full email like `hr@acme.com` is accepted and reduced to its domain.
- **Perk debugger** ("Check a customer"): type an email and get a checklist: program on, account exists, removed, which business (by domain or verified link), paused, limit used, with the fix for each failure.
- **Navigation:** Home, Businesses, Employees, Reports, Storefront, Settings. Activity and Help are linked from Home and Settings. The Home nav link is `rel="home"` so the app title opens the app.
- **Uninstall-safe:** the app never writes theme code (no `write_themes`). Help explains that employee-only products become normal products after uninstall.

## Why

- Merchant feedback: setup was too much work, help had to be everywhere, and "people are dumb" (no hidden steps).
- The most common support question in this category is "why doesn't X get the discount".
