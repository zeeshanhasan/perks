export const DISCOUNT_MIN = 1;
export const DISCOUNT_MAX = 90;
export const MONTHS_MIN = 1;
export const MONTHS_MAX = 24;

export type DiscountScope = "selected" | "all_products";

/** Store-wide program settings (per-business settings live on Business). */
export type SettingsInput = {
  enabled: boolean;
  autoDomain: boolean;
  eligibilityMonths: number | null;
  combinesWithProduct: boolean;
  combinesWithOrder: boolean;
  combinesWithShipping: boolean;
  excludedProducts: string[];
};

export type SettingsResult = { ok: true; value: SettingsInput } | { ok: false; errors: Record<string, string> };

/** Validates the admin Settings form. */
export function parseSettingsForm(form: FormData): SettingsResult {
  const errors: Record<string, string> = {};
  const monthsRaw = String(form.get("eligibilityMonths") ?? "12");
  let eligibilityMonths: number | null = null;
  if (monthsRaw !== "none") {
    const m = Number(monthsRaw);
    if (!Number.isInteger(m) || m < MONTHS_MIN || m > MONTHS_MAX)
      errors.eligibilityMonths = `Whole number of months from ${MONTHS_MIN} to ${MONTHS_MAX}, or no expiry`;
    else eligibilityMonths = m;
  }
  if (Object.keys(errors).length) return { ok: false, errors };
  // Checked checkboxes submit a value; unchecked ones submit nothing.
  const bool = (k: string) => {
    const v = form.get(k);
    return v !== null && v !== "false";
  };
  return {
    ok: true,
    value: {
      enabled: bool("enabled"),
      autoDomain: bool("autoDomain"),
      eligibilityMonths,
      combinesWithProduct: bool("combinesWithProduct"),
      combinesWithOrder: bool("combinesWithOrder"),
      combinesWithShipping: bool("combinesWithShipping"),
      excludedProducts: parseProductIds(form.get("excludedProducts")),
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
