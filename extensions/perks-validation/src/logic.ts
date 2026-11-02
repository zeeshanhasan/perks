import { isEligible } from "./eligibility";

type Meta = { value: string } | null | undefined;
export type ValidationInput = {
  buyerJourney: { step?: string | null };
  cart: {
    buyerIdentity?: { customer?: { eligibility?: Meta } | null } | null;
    lines: Array<{
      merchandise:
        | { __typename: "ProductVariant"; product: { employeeOnly?: Meta } }
        | { __typename: string };
    }>;
  };
  shop: { localTime: { date: string } };
};

export type ValidationOutput = {
  operations: Array<{ validationAdd: { errors: Array<{ message: string; target: string }> } }>;
};

export const BLOCK_MESSAGE =
  "Some items in your cart are for verified employees only. Log in and verify your work email to buy them, or remove them.";

/** Fail closed: any employee-only line + not provably eligible = blocked. */
export function validateCart(input: ValidationInput): ValidationOutput {
  const hasEmployeeOnly = input.cart.lines.some((line) => {
    const m = line.merchandise;
    return m.__typename === "ProductVariant" && "product" in m && m.product.employeeOnly?.value === "true";
  });
  const eligible = isEligible(
    input.cart.buyerIdentity?.customer?.eligibility?.value,
    input.shop.localTime.date,
  );
  const errors = hasEmployeeOnly && !eligible ? [{ message: BLOCK_MESSAGE, target: "$.cart" }] : [];
  return { operations: [{ validationAdd: { errors } }] };
}
