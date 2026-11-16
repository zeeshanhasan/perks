import { matches, parseConfig, resolveBusiness, usedInPeriod, type Business, type Buyer, type ProductInput } from "./eligibility";

export type DiscountInput = {
  cart: {
    buyerIdentity?: Buyer;
    lines: Array<{
      id: string;
      quantity?: number;
      cost?: { subtotalAmount?: { amount: string | number } | null } | null;
      merchandise: { __typename: string; product?: ProductInput };
    }>;
  };
  /** Shop currency → cart currency. Limits are kept in the shop's currency. */
  presentmentCurrencyRate?: string | number | null;
  shop: { localTime: { date: string } };
  discount: { discountClasses: string[]; config?: { value: string } | null };
};

type Value = { percentage: { value: number } } | { fixedAmount: { amount: number; appliesToEachItem: boolean } };
export type DiscountOutput = {
  operations: Array<{
    productDiscountsAdd: {
      candidates: Array<{ message: string; targets: Array<{ cartLine: { id: string } }>; value: Value }>;
      selectionStrategy: "FIRST" | "ALL";
    };
  }>;
};

const EMPTY: DiscountOutput = { operations: [] };

export function generateDiscounts(input: DiscountInput): DiscountOutput {
  if (!input.discount.discountClasses.includes("PRODUCT")) return EMPTY;
  const config = parseConfig(input.discount.config?.value);
  if (!config) return EMPTY;
  const today = input.shop.localTime.date;
  const biz = resolveBusiness(input.cart.buyerIdentity, config, today);
  if (!biz) return EMPTY;
  const used = usedInPeriod(input.cart.buyerIdentity?.customer?.usage?.value, biz, today);
  if (biz.limit && !(used < biz.limit.amount)) return EMPTY;

  const lines = input.cart.lines.filter((line) => {
    const p = line.merchandise.__typename === "ProductVariant" ? line.merchandise.product : undefined;
    if (!p || (p.id && config.excluded.includes(p.id))) return false;
    return matches(p, biz.target) || matches(p, biz.employeeOnly);
  });
  if (!lines.length) return EMPTY;

  const value: Value =
    biz.type === "fixed"
      ? { fixedAmount: { amount: biz.value, appliesToEachItem: true } }
      : { percentage: { value: biz.value } };
  const message = biz.type === "fixed" ? "Employee price" : `Employee price (${biz.value}% off)`;
  const full = { message, targets: lines.map((l) => ({ cartLine: { id: l.id } })), value };
  if (!biz.limit) return { operations: [{ productDiscountsAdd: { candidates: [full], selectionStrategy: "FIRST" } }] };

  const rate = Number(input.presentmentCurrencyRate ?? 1);
  const capped = capToLimit(lines, biz, (biz.limit.amount - used) * (rate > 0 ? rate : 1), rate > 0 ? rate : 1);
  if (!capped) return { operations: [{ productDiscountsAdd: { candidates: [full], selectionStrategy: "FIRST" } }] };
  const candidates: DiscountOutput["operations"][number]["productDiscountsAdd"]["candidates"] = [];
  if (capped.fullIds.length) candidates.push({ ...full, targets: capped.fullIds.map((id) => ({ cartLine: { id } })) });
  if (capped.partial)
    candidates.push({
      message: "Employee price (rest of your limit)",
      targets: [{ cartLine: { id: capped.partial.id } }],
      value: { fixedAmount: { amount: capped.partial.amount, appliesToEachItem: false } },
    });
  if (!candidates.length) return EMPTY;
  return { operations: [{ productDiscountsAdd: { candidates, selectionStrategy: "ALL" } }] };
}

const floor2 = (n: number) => Math.floor(n * 100 + 1e-6) / 100;

/**
 * Gives the full discount line by line until the employee's limit runs out; the line where it runs out
 * gets only what's left (a fixed amount) or, with overflow "whole", nothing. Later lines get nothing.
 *  - Limit on discount: the discount given stops at the amount left.
 *  - Limit on spend: only the part of the cart that fits in the spend left is discounted.
 * `left` is in the cart's currency. Returns null when the whole cart fits (use the normal discount).
 * A line without a price fails closed: no discount from there on.
 */
export function capToLimit(
  lines: DiscountInput["cart"]["lines"],
  biz: Business,
  left: number,
  rate = 1,
): { fullIds: string[]; partial: { id: string; amount: number } | null } | null {
  if (!biz.limit) return null;
  const fullIds: string[] = [];
  let remaining = left;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    const subtotal = Number(l.cost?.subtotalAmount?.amount);
    if (!Number.isFinite(subtotal) || subtotal < 0) return { fullIds, partial: null };
    // The discount this line gets in full. Fixed amounts are per unit (shop currency) and never more
    // than the line's price, as Shopify applies them.
    const units = Number(l.quantity) > 0 ? Number(l.quantity) : 1;
    const lineDiscount = biz.type === "fixed" ? Math.min(subtotal, biz.value * rate * units) : (subtotal * biz.value) / 100;
    const cost = biz.limit.basis === "spend" ? subtotal - lineDiscount : lineDiscount;
    if (cost <= remaining + 1e-9) {
      fullIds.push(l.id);
      remaining -= cost;
      continue;
    }
    // Runs out on this line. "whole": items that don't fit in full get nothing.
    if (biz.limit.overflow === "whole") return { fullIds, partial: null };
    let amount = 0;
    if (biz.limit.basis === "discount") amount = remaining;
    else {
      const share = subtotal > 0 ? lineDiscount / subtotal : 0; // discount per unit of price
      amount = share >= 1 ? lineDiscount : (remaining * share) / (1 - share);
    }
    amount = floor2(Math.max(0, Math.min(amount, lineDiscount)));
    return { fullIds, partial: amount > 0 ? { id: l.id, amount } : null };
  }
  return null;
}
