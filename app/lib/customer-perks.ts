/** What the customer-page block shows. Pure, so it's unit-tested. */

export type PeriodUsage = { md: number; ms: number; yd: number; ys: number };

export type LimitUsage = {
  period: "month" | "year";
  basis: "discount" | "spend";
  limit: number;
  used: number;
  left: number;
  /** 0–100, for the progress bar. */
  percent: number;
};

/** How much of the business's per-employee limit this customer has used this month/year. null when there's no limit. */
export function limitUsage(
  b: { limitPeriod: string; limitBasis: string; limitAmount: number | null },
  u: PeriodUsage | undefined,
): LimitUsage | null {
  if ((b.limitPeriod !== "month" && b.limitPeriod !== "year") || !b.limitAmount || b.limitAmount <= 0) return null;
  const usage = u ?? { md: 0, ms: 0, yd: 0, ys: 0 };
  const spend = b.limitBasis === "spend";
  const used = b.limitPeriod === "month" ? (spend ? usage.ms : usage.md) : spend ? usage.ys : usage.yd;
  const left = Math.max(0, Math.round((b.limitAmount - used) * 100) / 100);
  return {
    period: b.limitPeriod,
    basis: spend ? "spend" : "discount",
    limit: b.limitAmount,
    used,
    left,
    percent: Math.min(100, Math.round((used / b.limitAmount) * 100)),
  };
}

/** "Work-email login" / "Verified by email link" for how they joined. */
export function joinedBy(source: string | null | undefined) {
  if (source === "domain") return "Work-email login";
  if (source === "link") return "Verified by email link";
  return "Work-email login";
}
