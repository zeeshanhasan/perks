import { isEligible } from "./eligibility";

export type DiscountConfig = { percent: number; scope: "employee_only" | "all_products" };

export function parseConfig(raw: string | null | undefined): DiscountConfig | null {
  if (!raw) return null;
  try {
    const c = JSON.parse(raw);
    const percent = Number(c?.percent);
    if (c?.v !== 1 || !Number.isFinite(percent) || percent < 1 || percent > 90) return null;
    const scope = c.scope === "all_products" ? "all_products" : "employee_only";
    return { percent, scope };
  } catch {
    return null;
  }
}

type Meta = { value: string } | null | undefined;
export type DiscountInput = {
  cart: {
    buyerIdentity?: { customer?: { eligibility?: Meta } | null } | null;
    lines: Array<{
      id: string;
      merchandise:
        | { __typename: "ProductVariant"; product: { employeeOnly?: Meta; excluded?: Meta } }
        | { __typename: string };
    }>;
  };
  shop: { localTime: { date: string } };
  discount: { discountClasses: string[]; config?: Meta };
};

export type DiscountOutput = {
  operations: Array<{
    productDiscountsAdd: {
      candidates: Array<{
        message: string;
        targets: Array<{ cartLine: { id: string } }>;
        value: { percentage: { value: number } };
      }>;
      selectionStrategy: "FIRST";
    };
  }>;
};

const EMPTY: DiscountOutput = { operations: [] };
const isTrue = (m: Meta) => m?.value === "true";

export function generateDiscounts(input: DiscountInput): DiscountOutput {
  if (!input.discount.discountClasses.includes("PRODUCT")) return EMPTY;
  const config = parseConfig(input.discount.config?.value);
  if (!config) return EMPTY;
  const eligibility = input.cart.buyerIdentity?.customer?.eligibility?.value;
  if (!isEligible(eligibility, input.shop.localTime.date)) return EMPTY;

  const targets = input.cart.lines
    .filter((line) => {
      const m = line.merchandise;
      if (m.__typename !== "ProductVariant" || !("product" in m)) return false;
      if (isTrue(m.product.excluded)) return false;
      return config.scope === "all_products" || isTrue(m.product.employeeOnly);
    })
    .map((line) => ({ cartLine: { id: line.id } }));

  if (!targets.length) return EMPTY;
  return {
    operations: [
      {
        productDiscountsAdd: {
          candidates: [
            {
              message: `Employee perk ${config.percent}% off`,
              targets,
              value: { percentage: { value: config.percent } },
            },
          ],
          selectionStrategy: "FIRST",
        },
      },
    ],
  };
}
