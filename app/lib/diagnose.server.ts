import db from "../db.server";
import type { AdminClient } from "./admin-graphql.server";
import { gql } from "./admin-graphql.server";
import { formatMoney } from "./business";
import { listBusinesses } from "./business.server";
import { diagnose } from "./diagnose";
import { normalizeEmail } from "./domain";
import { getMembership } from "./membership.server";
import { buildUsage } from "./usage";

/** Gathers what the perk debugger needs for one email. Never logs the email. */
export async function diagnoseEmail(admin: AdminClient, shop: string, rawEmail: string, currency: string) {
  const email = normalizeEmail(rawEmail);
  if (!email) return { ok: false as const, error: "Enter a valid email address" };

  const [policy, businesses] = await Promise.all([db.benefitPolicy.findUnique({ where: { shop } }), listBusinesses(shop)]);

  const data = await gql<{ customers: { nodes: { id: string }[] } }>(
    admin,
    `#graphql
    query PerksFindCustomer($q: String!) { customers(first: 1, query: $q) { nodes { id } } }`,
    { q: `email:"${email.replace(/"/g, "")}"` },
  );
  const gid = data.customers.nodes[0]?.id ?? null;
  const customerId = gid ? gid.split("/").pop()! : null;

  const now = new Date();
  const [membership, rows] = customerId
    ? await Promise.all([
        getMembership(shop, customerId),
        db.orderUsage.findMany({
          where: { shop, customerId, cancelled: false, processedAt: { gte: new Date(Date.UTC(now.getUTCFullYear(), 0, 1)) } },
          select: { businessId: true, processedAt: true, spend: true, discount: true },
        }),
      ])
    : [null, []];

  const result = diagnose({
    email,
    programOn: Boolean(policy?.enabled && businesses.some((b) => b.active)),
    autoDomain: policy?.autoDomain ?? true,
    businesses,
    customer: customerId ? { id: customerId } : null,
    membership,
    usage: buildUsage(rows, now).b,
    now,
    formatMoney: (n) => formatMoney(n, currency),
  });
  return { ok: true as const, email, ...result };
}
