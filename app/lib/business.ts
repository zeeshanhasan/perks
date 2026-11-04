import { parseDomainList } from "./domain";
import type { Targeting } from "./targeting";
import { isEmptyTarget, parseTargeting } from "./targeting";

export type DiscountType = "percentage" | "fixed";
export type LimitPeriod = "none" | "month" | "year";
export type LimitBasis = "discount" | "spend";

export type BusinessInput = {
  name: string;
  domains: string[];
  discountType: DiscountType;
  discountValue: number;
  discountTarget: Targeting;
  employeeOnlyTarget: Targeting;
  limitPeriod: LimitPeriod;
  limitBasis: LimitBasis;
  limitAmount: number | null;
  billingEmail: string;
  billingAddress: string;
  active: boolean;
};

export type BusinessResult = { ok: true; value: BusinessInput } | { ok: false; errors: Record<string, string> };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function parseBusinessForm(form: FormData): BusinessResult {
  const errors: Record<string, string> = {};
  const name = String(form.get("name") ?? "").trim().slice(0, 120);
  if (!name) errors.name = "Business name is required";

  const { domains, invalid } = parseDomainList(String(form.get("domains") ?? ""));
  if (invalid.length) errors.domains = `Invalid domain(s): ${invalid.join(", ")}`;
  else if (!domains.length) errors.domains = "Add at least one email domain";

  const discountType: DiscountType = form.get("discountType") === "fixed" ? "fixed" : "percentage";
  const discountValue = Number(form.get("discountValue"));
  if (discountType === "percentage") {
    if (!Number.isFinite(discountValue) || discountValue < 1 || discountValue > 90 || !Number.isInteger(discountValue))
      errors.discountValue = "Whole number from 1 to 90";
  } else if (!Number.isFinite(discountValue) || discountValue <= 0 || discountValue > 1_000_000) {
    errors.discountValue = "Enter an amount greater than 0";
  }

  const discountTarget = parseTargeting(form.get("discountTarget"));
  const employeeOnlyTarget = { ...parseTargeting(form.get("employeeOnlyTarget")), all: false };
  if (isEmptyTarget(discountTarget) && isEmptyTarget(employeeOnlyTarget))
    errors.discountTarget = "Choose which products get the discount (or all products)";

  const period = String(form.get("limitPeriod") ?? "none");
  const limitPeriod: LimitPeriod = period === "month" || period === "year" ? period : "none";
  const limitBasis: LimitBasis = form.get("limitBasis") === "spend" ? "spend" : "discount";
  let limitAmount: number | null = null;
  if (limitPeriod !== "none") {
    const a = Number(form.get("limitAmount"));
    if (!Number.isFinite(a) || a <= 0) errors.limitAmount = "Enter a limit greater than 0";
    else limitAmount = Math.round(a * 100) / 100;
  }

  const billingEmail = String(form.get("billingEmail") ?? "").trim().slice(0, 200);
  if (billingEmail && !EMAIL.test(billingEmail)) errors.billingEmail = "Enter a valid email";
  const billingAddress = String(form.get("billingAddress") ?? "").trim().slice(0, 1000);

  if (Object.keys(errors).length) return { ok: false, errors };
  const v = form.get("active");
  return {
    ok: true,
    value: {
      name,
      domains,
      discountType,
      discountValue: discountType === "fixed" ? Math.round(discountValue * 100) / 100 : discountValue,
      discountTarget,
      employeeOnlyTarget,
      limitPeriod,
      limitBasis,
      limitAmount,
      billingEmail,
      billingAddress,
      active: v !== null && v !== "false",
    },
  };
}

/** "15% off" / "Rs 200.00 off each item" */
export function describeDiscount(b: { discountType: string; discountValue: number }, currency = "PKR") {
  if (b.discountType === "fixed")
    return `${formatMoney(b.discountValue, currency)} off each item`;
  return `${b.discountValue}% off`;
}

export function describeLimit(
  b: { limitPeriod: string; limitBasis: string; limitAmount: number | null },
  currency = "PKR",
) {
  if (b.limitPeriod === "none" || !b.limitAmount) return "No limit";
  const what = b.limitBasis === "spend" ? "spend" : "discount";
  return `${formatMoney(b.limitAmount, currency)} ${what} per employee per ${b.limitPeriod}`;
}

export function formatMoney(amount: number, currency = "PKR") {
  try {
    return new Intl.NumberFormat("en", { style: "currency", currency, maximumFractionDigits: 2 }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}
