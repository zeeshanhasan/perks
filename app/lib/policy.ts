import { parseDomainList } from "./domain";

export const DISCOUNT_MIN = 1;
export const DISCOUNT_MAX = 90;
export const MONTHS_MIN = 1;
export const MONTHS_MAX = 24;

export type DiscountScope = "selected" | "all_products";

export type SettingsInput = {
  employerName: string;
  domains: string[];
  discountPercent: number;
  eligibilityMonths: number | null;
  discountScope: DiscountScope;
  autoDomain: boolean;
  combinesWithProduct: boolean;
  combinesWithOrder: boolean;
  combinesWithShipping: boolean;
  enabled: boolean;
};

export type SettingsResult =
  | { ok: true; value: SettingsInput }
  | { ok: false; errors: Record<string, string> };

/** Validates the admin Settings form. */
export function parseSettingsForm(form: FormData): SettingsResult {
  const errors: Record<string, string> = {};
  const employerName = String(form.get("employerName") ?? "").trim().slice(0, 120);
  if (!employerName) errors.employerName = "Employer name is required";

  const { domains, invalid } = parseDomainList(String(form.get("domains") ?? ""));
  if (invalid.length) errors.domains = `Invalid domain(s): ${invalid.join(", ")}`;
  else if (!domains.length) errors.domains = "Add at least one domain";

  const pct = Number(form.get("discountPercent"));
  if (!Number.isInteger(pct) || pct < DISCOUNT_MIN || pct > DISCOUNT_MAX)
    errors.discountPercent = `Whole number from ${DISCOUNT_MIN} to ${DISCOUNT_MAX}`;

  const monthsRaw = String(form.get("eligibilityMonths") ?? "");
  let eligibilityMonths: number | null = null;
  if (monthsRaw !== "none") {
    const m = Number(monthsRaw);
    if (!Number.isInteger(m) || m < MONTHS_MIN || m > MONTHS_MAX)
      errors.eligibilityMonths = `Whole number of months from ${MONTHS_MIN} to ${MONTHS_MAX}, or no expiry`;
    else eligibilityMonths = m;
  }

  const scopeRaw = String(form.get("discountScope") ?? "selected");
  const scope = scopeRaw === "employee_only" ? "selected" : scopeRaw;
  if (scope !== "selected" && scope !== "all_products") errors.discountScope = "Invalid scope";

  if (Object.keys(errors).length) return { ok: false, errors };
  // Checked checkboxes submit a value; unchecked ones submit nothing.
  const bool = (k: string) => {
    const v = form.get(k);
    return v !== null && v !== "false";
  };
  return {
    ok: true,
    value: {
      employerName,
      domains,
      discountPercent: pct,
      eligibilityMonths,
      discountScope: scope as DiscountScope,
      autoDomain: bool("autoDomain"),
      combinesWithProduct: bool("combinesWithProduct"),
      combinesWithOrder: bool("combinesWithOrder"),
      combinesWithShipping: bool("combinesWithShipping"),
      enabled: bool("enabled"),
    },
  };
}

export function normalizeScope(scope: string | null | undefined): DiscountScope {
  return scope === "all_products" ? "all_products" : "selected";
}

export function parseJsonList(raw: string | null | undefined): string[] {
  try {
    const v = JSON.parse(raw ?? "[]");
    return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

const PRODUCT_GID = /^gid:\/\/shopify\/Product\/\d+$/;
export function parseProductIds(raw: unknown): string[] {
  const list = typeof raw === "string" ? parseJsonList(raw) : [];
  return [...new Set(list.filter((id) => PRODUCT_GID.test(id)))];
}
