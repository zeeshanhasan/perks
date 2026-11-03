import type { CartValidationsGenerateRunInput, CartValidationsGenerateRunResult } from "../generated/api";
import { validateCart, type ValidationInput } from "./logic";

export function cartValidationsGenerateRun(input: CartValidationsGenerateRunInput): CartValidationsGenerateRunResult {
  return validateCart(input as unknown as ValidationInput) as unknown as CartValidationsGenerateRunResult;
}
