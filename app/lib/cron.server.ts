import db from "../db.server";
import { sweepExpired } from "./membership.server";
import { pruneRateLimits } from "./rate-limit.server";
import { unauthenticated } from "../shopify.server";

/** Expires link-verified memberships past their date, across all shops. Idempotent. */
export async function runExpirySweep() {
  const shops = await db.employeeMembership.findMany({
    where: { status: "active", source: "link", expiresAt: { lte: new Date() } },
    distinct: ["shop"],
    select: { shop: true },
  });
  const results: Record<string, unknown> = {};
  for (const { shop } of shops) {
    try {
      const { admin } = await unauthenticated.admin(shop);
      results[shop] = await sweepExpired(admin, shop);
    } catch (err) {
      console.error("[perks] sweep failed", shop, err);
      results[shop] = { error: true };
    }
  }
  await pruneRateLimits();
  return results;
}

const HOUR = 60 * 60 * 1000;

/** In-process hourly scheduler for single-instance hosting (Railway). */
export function startScheduler() {
  const g = globalThis as { __perksScheduler?: ReturnType<typeof setInterval> };
  if (g.__perksScheduler || process.env.NODE_ENV !== "production" || process.env.PERKS_SCHEDULER === "off") return;
  const tick = () =>
    runExpirySweep()
      .then((r) => Object.keys(r).length && console.log("[perks] expiry sweep", JSON.stringify(r)))
      .catch((err) => console.error("[perks] expiry sweep error", err));
  g.__perksScheduler = setInterval(tick, HOUR);
  setTimeout(tick, 60_000);
}
