import { isEligibleBuyer, parseEligibilityConfig, type Buyer } from "./eligibility";

type Meta = { value: string } | null | undefined;
export type ValidationInput = {
  buyerJourney: { step?: string | null };
  cart: {
    buyerIdentity?: Buyer;
    lines: Array<{
      merchandise:
        | { __typename: "ProductVariant"; product: { employeeOnly?: Meta } }
        | { __typename: string };
    }>;
  };
  shop: { localTime: { date: string } };
  validation?: { config?: Meta } | null;
};

export type ValidationOutput = {
  operations: Array<{ validationAdd: { errors: Array<{ message: string; target: string }> } }>;
};

export const BLOCK_MESSAGE =
  "Some items in your cart are for employees only. Log in with your work email (or verify it) to buy them, or remove them.";

function config(raw: string | null | undefined) {
  if (!raw) return parseEligibilityConfig(null);
  try {
    const c = JSON.parse(raw);
    return c?.v === 1 ? parseEligibilityConfig(c) : parseEligibilityConfig(null);
  } catch {
    return parseEligibilityConfig(null);
  }
}

/** Fail closed: any employee-only line + not provably eligible = blocked. */
export function validateCart(input: ValidationInput): ValidationOutput {
  const hasEmployeeOnly = input.cart.lines.some((line) => {
    const m = line.merchandise;
    return m.__typename === "ProductVariant" && "product" in m && m.product.employeeOnly?.value === "true";
  });
  const eligible =
    hasEmployeeOnly &&
    isEligibleBuyer(input.cart.buyerIdentity, config(input.validation?.config?.value), input.shop.localTime.date);
  const errors = hasEmployeeOnly && !eligible ? [{ message: BLOCK_MESSAGE, target: "$.cart" }] : [];
  return { operations: [{ validationAdd: { errors } }] };
}
