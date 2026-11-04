# 013: Medical allowance direction (parked)

**Status:** Proposed, parked · **Date:** 2026-11-04

## Context

Pakistani companies give employees a yearly OPD/medication allowance (e.g. Rs 50,000), reimbursed against receipts. Fake receipts are a known problem.

## Options considered

| Option | Verdict |
|---|---|
| Shopify gift card per employee | Rejected: codes can be shared |
| Shopify store credit per employee (company billed monthly) | Viable (tied to login, expiry, POS), but the store carries credit risk |
| Bill-to-employer payment method | Credit risk, no split payment online |
| **Verified claims**: employee pays, Perks tracks the allowance and issues verifiable claim receipts and a monthly HR statement | **Preferred by Zeeshan**: no fraud or credit risk for the store |

## Preferred design (verified claims)

- Allowance per business: amount, period, eligible products (targeting), HR email.
- Employee pays normally. Claimable amount per order = eligible items, capped by remaining allowance. Non-eligible items marked "not claimable".
- Claim receipt per order with a verification link/QR on `perks.tofoapp.com`. Cancelled/refunded orders drop out. One order can't be claimed twice.
- Monthly HR claim statement (PDF/CSV) using the invoice engine.

## Open questions

1. Discount as well as the allowance?
2. Receipt to HR per order, or only the monthly statement?
3. Over the cap: buy at normal price and mark not claimable (proposed), or block?
