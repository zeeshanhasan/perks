/**
 * Eligibility value published to the customer metafield `$app.perks_eligibility`.
 * Shape is shared with the Functions (extensions/perks-*). Bump `v` on breaking changes.
 */
export type EligibilityValue =
  | {
      v: 1;
      status: "active";
      /** YYYY-MM-DD. Eligible while the shop's local date is strictly before this. null = no expiry. */
      expiresAt: string | null;
      /** Business the employee verified for (absent on legacy v1 values). */
      businessId?: string;
    }
  /** Blocks the customer even if their account email domain is approved. */
  | { v: 1; status: "revoked" };

export const REVOKED_VALUE: EligibilityValue = { v: 1, status: "revoked" };

export const ELIGIBILITY_NAMESPACE = "$app";
export const ELIGIBILITY_KEY = "perks_eligibility";
export const EMPLOYEE_ONLY_KEY = "perks_employee_only";
export const DISCOUNT_EXCLUDED_KEY = "perks_discount_excluded";
export const DISCOUNTED_KEY = "perks_discounted";
/** App-data metafield (owner: current app installation), read by the theme embed as app.metafields.perks.storefront */
export const STOREFRONT_NAMESPACE = "perks";
export const STOREFRONT_KEY = "storefront";
export const DISCOUNT_CONFIG_KEY = "perks_config";
export const USAGE_KEY = "perks_usage";

export function addMonths(date: Date, months: number): Date {
  const d = new Date(date.getTime());
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, lastDay));
  return d;
}

export function computeExpiry(verifiedAt: Date, months: number | null): Date | null {
  return months == null ? null : addMonths(verifiedAt, months);
}

export function toDateString(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function buildEligibilityValue(expiresAt: Date | null, businessId?: string | null): EligibilityValue {
  return {
    v: 1,
    status: "active",
    expiresAt: expiresAt ? toDateString(expiresAt) : null,
    ...(businessId ? { businessId } : {}),
  };
}

export function isExpired(expiresAt: Date | null, now: Date): boolean {
  return expiresAt != null && expiresAt.getTime() <= now.getTime();
}
