import db from "../db.server";
import type { AdminClient } from "./admin-graphql.server";
import { ELIGIBILITY_NAMESPACE, USAGE_KEY } from "./eligibility";
import { businessOf, getMembership, getProgram, isDomainEligible } from "./membership.server";
import { customerGid, setMetafields } from "./metafields.server";
import { buildUsage, orderItems, orderSummary, periodKeys } from "./usage";

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
  const items = JSON.stringify(orderItems(payload as Parameters<typeof orderItems>[0]));
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
      items,
      email: (o.email ?? "").slice(0, 255),
      fulfillment: o.fulfillment,
      cancelled: o.cancelled,
    },
    update: { spend: o.spend, total: o.total, discount: o.discount, items, fulfillment: o.fulfillment },
  });
  if (admin) await publishUsage(admin, shop, o.customerId);
  return "recorded" as const;
}

/**
 * orders/updated (fulfilment, edits, refunds, cancellation): keeps a recorded employee order current.
 * Orders we never recorded are left alone: who the buyer worked for is decided once, when the order is placed.
 */
export async function updateOrder(shop: string, payload: unknown, admin?: AdminClient | null) {
  const o = orderSummary(payload as Parameters<typeof orderSummary>[0]);
  if (!o.orderId) return "skipped" as const;
  const row = await db.orderUsage.findFirst({ where: { shop, orderId: o.orderId } });
  if (!row) return "skipped" as const;
  const items = orderItems(payload as Parameters<typeof orderItems>[0]);
  const changed = row.spend !== o.spend || row.discount !== o.discount || (o.cancelled && !row.cancelled);
  await db.orderUsage.update({
    where: { id: row.id },
    data: {
      spend: o.spend,
      total: o.total,
      discount: o.discount,
      fulfillment: o.fulfillment,
      // A cancelled order stays cancelled (Shopify can't un-cancel).
      cancelled: row.cancelled || o.cancelled,
      ...(items.length ? { items: JSON.stringify(items) } : {}),
    },
  });
  // Limits only depend on money and cancellation.
  if (admin && changed) await publishUsage(admin, shop, row.customerId);
  return "updated" as const;
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
