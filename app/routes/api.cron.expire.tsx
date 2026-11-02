import type { ActionFunctionArgs } from "react-router";
import { timingSafeEqual } from "node:crypto";
import db from "../db.server";
import { sweepExpired } from "../lib/membership.server";
import { pruneRateLimits } from "../lib/rate-limit.server";
import { unauthenticated } from "../shopify.server";

/**
 * POST /api/cron/expire with `Authorization: Bearer $CRON_SECRET`.
 * Called by the scheduler (Workers Cron in production; curl in dev).
 */
function authorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const got = Buffer.from(request.headers.get("authorization") ?? "");
  const want = Buffer.from(`Bearer ${secret}`);
  return got.length === want.length && timingSafeEqual(got, want);
}

export const action = async ({ request }: ActionFunctionArgs) => {
  if (!authorized(request)) return new Response("Unauthorized", { status: 401 });
  const shops = await db.employeeMembership.findMany({
    where: { status: "active", expiresAt: { lte: new Date() } },
    distinct: ["shop"],
    select: { shop: true },
  });
  const results: Record<string, unknown> = {};
  for (const { shop } of shops) {
    try {
      const { admin } = await unauthenticated.admin(shop);
      results[shop] = await sweepExpired(admin, shop);
    } catch (err) {
      console.error("[perks] cron sweep failed", shop, err);
      results[shop] = { error: true };
    }
  }
  await pruneRateLimits();
  return Response.json({ ok: true, results });
};

export const loader = () => new Response("Method Not Allowed", { status: 405 });
