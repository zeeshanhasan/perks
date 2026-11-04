import db from "../db.server";
import { round2 } from "./usage";
import { lastDay, toCsv, ymd } from "./report";

export type Basis = "discount" | "spend";

export async function businessSummary(shop: string, from: Date, to: Date) {
  const [businesses, rows] = await Promise.all([
    db.business.findMany({ where: { shop }, orderBy: { createdAt: "asc" } }),
    db.orderUsage.findMany({
      where: { shop, cancelled: false, processedAt: { gte: from, lt: to } },
      select: { businessId: true, customerId: true, spend: true, total: true, discount: true, currency: true },
    }),
  ]);
  const currency = rows[0]?.currency ?? "PKR";
  const by = new Map<string, { orders: number; employees: Set<string>; spend: number; total: number; discount: number }>();
  for (const r of rows) {
    const x = by.get(r.businessId) ?? { orders: 0, employees: new Set<string>(), spend: 0, total: 0, discount: 0 };
    x.orders++;
    x.employees.add(r.customerId);
    x.spend += r.spend;
    x.total += r.total;
    x.discount += r.discount;
    by.set(r.businessId, x);
  }
  // Deleted businesses only show up when they have orders in the range.
  const lines = businesses.filter((b) => !b.archivedAt || by.has(b.id)).map((b) => {
    const x = by.get(b.id);
    return {
      businessId: b.id,
      name: b.archivedAt ? `${b.name} (deleted)` : b.name,
      orders: x?.orders ?? 0,
      employees: x?.employees.size ?? 0,
      spend: round2(x?.spend ?? 0),
      total: round2(x?.total ?? 0),
      discount: round2(x?.discount ?? 0),
    };
  });
  const totals = lines.reduce(
    (t, l) => ({ orders: t.orders + l.orders, employees: t.employees + l.employees, spend: round2(t.spend + l.spend), discount: round2(t.discount + l.discount) }),
    { orders: 0, employees: 0, spend: 0, discount: 0 },
  );
  return { currency, lines, totals };
}

export async function ordersFor(shop: string, businessId: string, from: Date, to: Date) {
  return db.orderUsage.findMany({
    where: { shop, businessId, cancelled: false, processedAt: { gte: from, lt: to } },
    orderBy: { processedAt: "asc" },
  });
}

async function nextNumber(shop: string, now: Date) {
  const prefix = `INV-${now.toISOString().slice(0, 7).replace("-", "")}-`;
  const count = await db.invoice.count({ where: { shop, number: { startsWith: prefix } } });
  return `${prefix}${String(count + 1).padStart(3, "0")}`;
}

export async function createInvoice(shop: string, businessId: string, from: Date, to: Date, basis: Basis, now = new Date()) {
  const business = await db.business.findFirst({ where: { shop, id: businessId } });
  if (!business) throw new Error("Business not found");
  const orders = await ordersFor(shop, businessId, from, to);
  const amount = round2(orders.reduce((s, o) => s + (basis === "spend" ? o.spend : o.discount), 0));
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await db.invoice.create({
        data: {
          shop,
          businessId,
          number: await nextNumber(shop, now),
          periodStart: from,
          periodEnd: to,
          basis,
          amount,
          orderCount: orders.length,
          currency: orders[0]?.currency ?? "PKR",
          businessName: business.name,
          lines: JSON.stringify(
            orders.map((o) => ({
              orderName: o.orderName,
              date: ymd(o.processedAt),
              customerId: o.customerId,
              spend: o.spend,
              discount: o.discount,
            })),
          ),
        },
      });
    } catch (err) {
      if (attempt === 2) throw err; // number collision from a concurrent create: retry
    }
  }
  throw new Error("unreachable");
}

export type InvoiceLine = { orderName: string; date: string; customerId: string; spend: number; discount: number };

export async function getInvoice(shop: string, id: string) {
  const invoice = await db.invoice.findFirst({ where: { shop, id } });
  if (!invoice) return null;
  const business = await db.business.findFirst({ where: { shop, id: invoice.businessId } });
  let lines: InvoiceLine[] = [];
  try {
    lines = JSON.parse(invoice.lines);
  } catch {
    lines = [];
  }
  return { invoice, business, lines };
}

export async function listInvoices(shop: string) {
  return db.invoice.findMany({ where: { shop }, orderBy: { createdAt: "desc" }, take: 100 });
}

export function invoiceCsv(data: NonNullable<Awaited<ReturnType<typeof getInvoice>>>) {
  const { invoice, business, lines } = data;
  const rows: (string | number)[][] = [
    ["Invoice", invoice.number],
    ["Business", business?.name ?? invoice.businessName],
    ["Period", `${ymd(invoice.periodStart)} to ${lastDay({ to: invoice.periodEnd })}`],
    ["Billed on", invoice.basis === "spend" ? "Employee spend" : "Employee discount"],
    [],
    ["Order", "Date", "Customer ID", "Spend", "Discount", "Billed"],
    ...lines.map((o) => [
      o.orderName,
      o.date,
      o.customerId,
      o.spend.toFixed(2),
      o.discount.toFixed(2),
      (invoice.basis === "spend" ? o.spend : o.discount).toFixed(2),
    ]),
    [],
    ["Total", "", "", "", "", invoice.amount.toFixed(2)],
    ["Currency", invoice.currency],
  ];
  return toCsv(rows);
}
