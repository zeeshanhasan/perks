import { matches, parseConfig, resolveBusiness, type Buyer, type ProductInput } from "./eligibility";

export type ValidationInput = {
  buyerJourney: { step?: string | null };
  cart: { buyerIdentity?: Buyer; lines: Array<{ merchandise: { __typename: string; product?: ProductInput } }> };
  shop: { localTime: { date: string } };
  validation?: { config?: { value: string } | null } | null;
};

export type ValidationOutput = {
  operations: Array<{ validationAdd: { errors: Array<{ message: string; target: string }> } }>;
};

export const BLOCK_MESSAGE =
  "Some items in your cart are for employees of partner companies only. Log in with your work email (or verify it) to buy them, or remove them.";

/**
 * Fail closed. A line is employee-only if a business's employee-only targeting matches it live,
 * or the product carries the synced perks_employee_only flag (defence in depth).
 * The buyer must belong to a business that owns the line (flag-only lines: any business).
 */
export function validateCart(input: ValidationInput): ValidationOutput {
  const config = parseConfig(input.validation?.config?.value) ?? { autoDomain: false, excluded: [], businesses: [] };
  let buyerBiz: ReturnType<typeof resolveBusiness> | undefined;
  const biz = () =>
    buyerBiz === undefined ? (buyerBiz = resolveBusiness(input.cart.buyerIdentity, config, input.shop.localTime.date)) : buyerBiz;

  const blocked = input.cart.lines.some((line) => {
    const p = line.merchandise.__typename === "ProductVariant" ? line.merchandise.product : undefined;
    if (!p) return false;
    const owners = config.businesses.filter((b) => matches(p, b.employeeOnly)).map((b) => b.id);
    const flagged = p.employeeOnly?.value === "true";
    if (!owners.length && !flagged) return false;
    const mine = biz();
    if (!mine) return true;
    return owners.length ? !owners.includes(mine.id) : false;
  });
  return { operations: [{ validationAdd: { errors: blocked ? [{ message: BLOCK_MESSAGE, target: "$.cart" }] : [] } }] };
}
