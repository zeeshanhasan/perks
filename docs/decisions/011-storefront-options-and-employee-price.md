# 011: Storefront options live in the app; employee price on product pages and cards

**Status:** Implemented, pending store check · **Date:** 2026-11-04

## Decision

- **Employee price:** logged-in employees see "Your employee price Rs X (15% off)" on product pages (normal price crossed out, follows variant changes) and on product cards (collections, search, home).
  - Computed in the theme from the business discount. Checkout stays the source of truth.
  - Fixed-amount discounts only show when browsing in the shop currency.
  - Product cards use `/products/<handle>.js` for prices. The storefront config lists each business's discounted handles (max 2,000) unless it discounts everything.
  - If the theme's price element isn't found, the price shows above the buy button; the old badge is the last fallback.
  - `?perks_debug=1` logs decisions to the browser console.
- **Storefront page in the app** (sidebar → Storefront):
  - Shows whether the Employee mode embed is on in the live theme, read from `config/settings_data.json` (scope `read_themes`).
  - "Turn on Employee mode" opens the theme editor with the embed pre-activated. Shopify doesn't let apps switch embeds on themselves; the merchant clicks Save.
  - Options and texts (show price, cross out, price label, hide employee-only products, notice title/text/button, fallback badge) are stored in `BenefitPolicy.storefront` and published as `ui` in the storefront config. The theme block keeps only colours and the employee collection.

## Theme extension rules (learned the hard way)

- The embed script must stay **under 10 KB** or dev preview and deploy fail. A test guards it.
- Shopify ends a `{{ }}` output tag at the first `}`: never put braces inside one. A test guards it.

## Consequences

- New scope `read_themes`: merchants re-approve; Railway `SCOPES` must include it.
