import db from "../db.server";
import type { AdminClient } from "./admin-graphql.server";
import { describeDiscount, formatMoney } from "./business";
import { listBusinesses } from "./business.server";
import { joinedBy, limitUsage } from "./customer-perks";
import { diagnose } from "./diagnose";
import { getCustomerEmail, getMembership } from "./membership.server";
import { describeTarget } from "./targeting";
import { buildUsage } from "./usage";

/**
 * Perks summary for one customer, for the block on the Shopify customer page.
 * Scoped by shop; the customer id comes from the admin (authenticated), never the storefront.
 * Never returns or logs the customer's email.
 */
export async function customerPerks(admin: AdminClient, shop: string, customerId: string, currency: string) {
  const now = new Date();
  const yearStart = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
  const [policy, businesses, membership, email, yearRows, lifetime] = await Promise.all([
    db.benefitPolicy.findUnique({ where: { shop } }),
    listBusinesses(shop),
    getMembership(shop, customerId),
    getCustomerEmail(admin, customerId),
    db.orderUsage.findMany({
      where: { shop, customerId, cancelled: false, processedAt: { gte: yearStart } },
      select: { businessId: true, processedAt: true, spend: true, discount: true },
    }),
    db.orderUsage.aggregate({ where: { shop, customerId, cancelled: false }, _sum: { discount: true }, _count: true }),
  ]);
  const money = (n: number) => formatMoney(n, currency);
  const usage = buildUsage(yearRows, now).b;

  const d = diagnose({
    email: email ?? "",
    programOn: Boolean(policy?.enabled && businesses.some((b) => b.active)),
    autoDomain: policy?.autoDomain ?? true,
    businesses,
    customer: { id: customerId },
    membership,
    usage,
    now,
    formatMoney: money,
  });

  const business = d.businessName ? (businesses.find((b) => b.name === d.businessName) ?? null) : null;
  const reason = d.eligible ? null : (d.checks.find((c) => c.status === "fail") ?? null);
  const limit = business ? limitUsage(business, usage[business.id]) : null;

  return {
    eligible: d.eligible,
    reason: reason ? { title: reason.title, detail: reason.detail ?? null } : null,
    business: business
      ? {
          name: business.name,
          discount: describeDiscount(business, currency),
          appliesTo: describeTarget(business.discountTarget, "Selected products"),
          employeeOnly: business.employeeOnlyTarget.all ? "All products" : describeTarget(business.employeeOnlyTarget, "None"),
        }
      : null,
    joinedBy: membership ? joinedBy(membership.source) : business ? joinedBy("domain") : null,
    since: membership?.verifiedAt ? membership.verifiedAt.toISOString().slice(0, 10) : null,
    expires: membership?.source === "link" && membership.expiresAt ? membership.expiresAt.toISOString().slice(0, 10) : null,
    limit: limit
      ? { ...limit, usedText: money(limit.used), leftText: money(limit.left), limitText: money(limit.limit) }
      : null,
    savedTotal: money(lifetime._sum.discount ?? 0),
    orders: lifetime._count,
    appUrl: "/app/employees",
  };
}

export type CustomerPerks = Awaited<ReturnType<typeof customerPerks>>;
