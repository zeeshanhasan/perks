import type { CartInput, CartLinesDiscountsGenerateRunResult } from "../generated/api";
import { generateDiscounts, type DiscountInput } from "./logic";

export function cartLinesDiscountsGenerateRun(input: CartInput): CartLinesDiscountsGenerateRunResult {
  return generateDiscounts(input as unknown as DiscountInput) as unknown as CartLinesDiscountsGenerateRunResult;
}
