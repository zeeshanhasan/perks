import { isEligibleBuyer, parseEligibilityConfig, type Buyer, type EligibilityConfig } from "./eligibility";

export type DiscountConfig = EligibilityConfig & { percent: number; scope: "selected" | "all_products" };

export function parseConfig(raw: string | null | undefined): DiscountConfig | null {
  if (!raw) return null;
  try {
    const c = JSON.parse(raw);
    const percent = Number(c?.percent);
    if (c?.v !== 1 || !Number.isInteger(percent) || percent < 1 || percent > 90) return null;
    const scope = c.scope === "all_products" ? "all_products" : "selected";
    return { percent, scope, ...parseEligibilityConfig(c) };
  } catch {
    return null;
  }
}

type Meta = { value: string } | null | undefined;
export type DiscountInput = {
  cart: {
    buyerIdentity?: Buyer;
    lines: Array<{
      id: string;
      merchandise:
        | { __typename: "ProductVariant"; product: { employeeOnly?: Meta; discounted?: Meta; excluded?: Meta } }
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
  if (!isEligibleBuyer(input.cart.buyerIdentity, config, input.shop.localTime.date)) return EMPTY;

  const targets = input.cart.lines
    .filter((line) => {
      const m = line.merchandise;
      if (m.__typename !== "ProductVariant" || !("product" in m)) return false;
      const p = m.product;
      if (isTrue(p.excluded)) return false;
      return config.scope === "all_products" || isTrue(p.employeeOnly) || isTrue(p.discounted);
    })
    .map((line) => ({ cartLine: { id: line.id } }));

  if (!targets.length) return EMPTY;
  return {
    operations: [
      {
        productDiscountsAdd: {
          candidates: [
            {
              message: `Employee price (${config.percent}% off)`,
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
