import type { ActionFunctionArgs } from "react-router";
import { timingSafeEqual } from "node:crypto";
import { runExpirySweep } from "../lib/cron.server";

/**
 * POST /api/cron/expire with `Authorization: Bearer $CRON_SECRET`.
 * Production also runs this hourly in-process (app/lib/cron.server.ts); this endpoint is for manual runs.
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
  return Response.json({ ok: true, results: await runExpirySweep() });
};

export const loader = () => new Response("Method Not Allowed", { status: 405 });
