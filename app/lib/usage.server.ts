import db from "../db.server";
import type { AdminClient } from "./admin-graphql.server";
import { ELIGIBILITY_NAMESPACE, USAGE_KEY } from "./eligibility";
import { businessOf, getMembership, getProgram, isDomainEligible } from "./membership.server";
import { customerGid, setMetafields } from "./metafields.server";
import { buildUsage, orderSummary, periodKeys } from "./usage";

/** Which business (if any) an order's customer belonged to at order time. */
async function businessForOrderCustomer(shop: string, customerId: string, email: string | null) {
  const m = await getMembership(shop, customerId);
  if (m?.status === "revoked") return null;
  if (m?.status === "active" && m.businessId) return m.businessId;
  const program = await getProgram(shop);
  if (isDomainEligible(program, email)) return businessOf(program, email)?.id ?? null;
  return null;
}

/** orders/create: record employee orders and refresh the customer's usage counters. */
export async function recordOrder(shop: string, payload: unknown, admin?: AdminClient | null) {
  const o = orderSummary(payload as Parameters<typeof orderSummary>[0]);
  if (!o.orderId || !o.customerId) return "skipped" as const;
  const businessId = await businessForOrderCustomer(shop, o.customerId, o.email);
  if (!businessId) return "skipped" as const;
  await db.orderUsage.upsert({
    where: { shop_orderId: { shop, orderId: o.orderId } },
    create: {
      shop,
      orderId: o.orderId,
      orderName: o.orderName,
      customerId: o.customerId,
      businessId,
      processedAt: o.processedAt,
      currency: o.currency,
      spend: o.spend,
      total: o.total,
      discount: o.discount,
    },
    update: { spend: o.spend, total: o.total, discount: o.discount },
  });
  if (admin) await publishUsage(admin, shop, o.customerId);
  return "recorded" as const;
}

/** orders/cancelled: exclude from reports and limits. */
export async function cancelOrder(shop: string, payload: unknown, admin?: AdminClient | null) {
  const o = orderSummary(payload as Parameters<typeof orderSummary>[0]);
  const row = await db.orderUsage.findFirst({ where: { shop, orderId: o.orderId } });
  if (!row) return;
  await db.orderUsage.update({ where: { id: row.id }, data: { cancelled: true } });
  if (admin) await publishUsage(admin, shop, row.customerId);
}

/** Writes the customer's period totals to $app.perks_usage (read by the discount Function for limits). */
export async function publishUsage(admin: AdminClient, shop: string, customerId: string, now = new Date()) {
  const yearStart = new Date(`${periodKeys(now).year}-01-01T00:00:00Z`);
  const rows = await db.orderUsage.findMany({
    where: { shop, customerId, cancelled: false, processedAt: { gte: yearStart } },
    select: { businessId: true, processedAt: true, spend: true, discount: true },
  });
  await setMetafields(admin, [
    {
      ownerId: customerGid(customerId),
      namespace: ELIGIBILITY_NAMESPACE,
      key: USAGE_KEY,
      type: "json",
      value: JSON.stringify(buildUsage(rows, now)),
    },
  ]);
}
