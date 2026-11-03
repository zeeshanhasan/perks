import { matches, parseConfig, resolveBusiness, withinLimit, type Buyer, type ProductInput } from "./eligibility";

export type DiscountInput = {
  cart: {
    buyerIdentity?: Buyer;
    lines: Array<{ id: string; merchandise: { __typename: string; product?: ProductInput } }>;
  };
  shop: { localTime: { date: string } };
  discount: { discountClasses: string[]; config?: { value: string } | null };
};

type Value = { percentage: { value: number } } | { fixedAmount: { amount: number; appliesToEachItem: boolean } };
export type DiscountOutput = {
  operations: Array<{
    productDiscountsAdd: {
      candidates: Array<{ message: string; targets: Array<{ cartLine: { id: string } }>; value: Value }>;
      selectionStrategy: "FIRST";
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
  if (!withinLimit(input.cart.buyerIdentity?.customer?.usage?.value, biz, today)) return EMPTY;

  const targets = input.cart.lines
    .filter((line) => {
      const p = line.merchandise.__typename === "ProductVariant" ? line.merchandise.product : undefined;
      if (!p || (p.id && config.excluded.includes(p.id))) return false;
      return matches(p, biz.target) || matches(p, biz.employeeOnly);
    })
    .map((line) => ({ cartLine: { id: line.id } }));
  if (!targets.length) return EMPTY;

  const value: Value =
    biz.type === "fixed"
      ? { fixedAmount: { amount: biz.value, appliesToEachItem: true } }
      : { percentage: { value: biz.value } };
  const message = biz.type === "fixed" ? "Employee price" : `Employee price (${biz.value}% off)`;
  return {
    operations: [{ productDiscountsAdd: { candidates: [{ message, targets, value }], selectionStrategy: "FIRST" } }],
  };
}
