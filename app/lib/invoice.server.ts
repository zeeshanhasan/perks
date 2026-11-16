import db from "../db.server";
import type { AdminClient } from "./admin-graphql.server";
import { gql } from "./admin-graphql.server";
import type { OrderItem } from "./usage";
import { PERKS_DISCOUNT_TITLES, parseItems, round2 } from "./usage";
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

/** Fills in line items for orders recorded before items were stored (from the Admin API), and saves them. Best effort. */
async function backfillItems(admin: AdminClient, rows: { id: string; orderId: string; items: string }[]) {
  const missing = rows.filter((r) => !parseItems(r.items).length);
  for (let i = 0; i < missing.length; i += 50) {
    const batch = missing.slice(i, i + 50);
    try {
      const data = await gql<{ nodes: (ShopifyOrder | null)[] }>(
        admin,
        `#graphql
        query PerksOrderItems($ids: [ID!]!) {
          nodes(ids: $ids) {
            ... on Order {
              id
              lineItems(first: 100) {
                nodes {
                  title
                  variantTitle
                  sku
                  quantity
                  originalUnitPriceSet { shopMoney { amount } }
                  discountedTotalSet { shopMoney { amount } }
                  discountAllocations {
                    allocatedAmountSet { shopMoney { amount } }
                    discountApplication { ... on AutomaticDiscountApplication { title } }
                  }
                }
              }
            }
          }
        }`,
        { ids: batch.map((r) => `gid://shopify/Order/${r.orderId}`) },
      );
      for (const node of data.nodes) {
        if (!node?.lineItems) continue;
        const row = batch.find((r) => node.id.endsWith(`/${r.orderId}`));
        if (!row) continue;
        const items = itemsFromAdmin(node);
        row.items = JSON.stringify(items);
        await db.orderUsage.update({ where: { id: row.id }, data: { items: row.items } });
      }
    } catch (err) {
      console.warn("[perks] couldn't load order items for invoice", err instanceof Error ? err.message : err);
    }
  }
}

type ShopifyOrder = {
  id: string;
  lineItems?: {
    nodes: {
      title: string;
      variantTitle: string | null;
      sku: string | null;
      quantity: number;
      originalUnitPriceSet: { shopMoney: { amount: string } };
      discountedTotalSet: { shopMoney: { amount: string } };
      discountAllocations: { allocatedAmountSet: { shopMoney: { amount: string } }; discountApplication: { title?: string } }[];
    }[];
  };
};

export function itemsFromAdmin(order: ShopifyOrder): OrderItem[] {
  return (order.lineItems?.nodes ?? []).map((li) => {
    const unitPrice = round2(Number(li.originalUnitPriceSet.shopMoney.amount) || 0);
    const perks = li.discountAllocations
      .filter((a) => PERKS_DISCOUNT_TITLES.some((t) => (a.discountApplication?.title ?? "").includes(t)))
      .reduce((s, a) => s + (Number(a.allocatedAmountSet.shopMoney.amount) || 0), 0);
    return {
      title: li.title,
      variant: li.variantTitle ?? "",
      sku: li.sku ?? "",
      quantity: li.quantity,
      unitPrice,
      discount: round2(perks),
      paid: round2(Number(li.discountedTotalSet.shopMoney.amount) || 0),
    };
  });
}

/** Work emails of the employees on an invoice (from their memberships). */
async function emailsFor(shop: string, customerIds: string[]) {
  if (!customerIds.length) return new Map<string, string>();
  const rows = await db.employeeMembership.findMany({
    where: { shop, customerId: { in: [...new Set(customerIds)] } },
    select: { customerId: true, workEmail: true },
  });
  return new Map(rows.map((r) => [r.customerId, r.workEmail]));
}

export async function createInvoice(
  shop: string,
  businessId: string,
  from: Date,
  to: Date,
  basis: Basis,
  now = new Date(),
  admin?: AdminClient | null,
) {
  const business = await db.business.findFirst({ where: { shop, id: businessId } });
  if (!business) throw new Error("Business not found");
  const orders = await ordersFor(shop, businessId, from, to);
  if (admin) await backfillItems(admin, orders);
  const emails = await emailsFor(shop, orders.map((o) => o.customerId));
  const amount = round2(orders.reduce((s, o) => s + (basis === "spend" ? o.spend : o.discount), 0));
  // Frozen snapshot: later cancellations or email changes don't change an issued invoice.
  const lines: InvoiceLine[] = orders.map((o) => ({
    orderName: o.orderName,
    date: ymd(o.processedAt),
    customerId: o.customerId,
    email: emails.get(o.customerId) || o.email || "",
    spend: o.spend,
    discount: o.discount,
    items: parseItems(o.items),
  }));
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
          lines: JSON.stringify(lines),
        },
      });
    } catch (err) {
      if (attempt === 2) throw err; // number collision from a concurrent create: retry
    }
  }
  throw new Error("unreachable");
}

/** One billed order, frozen on the invoice. email/items are missing on invoices issued before they were recorded. */
export type InvoiceLine = {
  orderName: string;
  date: string;
  customerId: string;
  email?: string;
  spend: number;
  discount: number;
  items?: OrderItem[];
};

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
  // Older invoices didn't freeze emails: look them up so nobody sees a bare customer ID.
  const missing = lines.filter((l) => !l.email).map((l) => l.customerId);
  if (missing.length) {
    const emails = await emailsFor(shop, missing);
    lines = lines.map((l) => (l.email ? l : { ...l, email: emails.get(l.customerId) ?? "" }));
  }
  return { invoice, business, lines };
}

export async function listInvoices(shop: string) {
  return db.invoice.findMany({ where: { shop }, orderBy: { createdAt: "desc" }, take: 100 });
}

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const monthOf = (date: string) => `${MONTH_NAMES[Number(date.slice(5, 7)) - 1]} ${date.slice(0, 4)}`;
const employeeOf = (l: InvoiceLine) => l.email || "Employee (email not recorded)";
const billedOf = (basis: string, o: { spend: number; discount: number }) => (basis === "spend" ? o.spend : o.discount);

export type EmployeeRow = {
  employee: string;
  month: string;
  orders: number;
  products: number;
  spend: number;
  discount: number;
  billed: number;
};

/** The invoice table: one row per employee per month. */
export function employeeRows(lines: InvoiceLine[], basis: string): EmployeeRow[] {
  const by = new Map<string, EmployeeRow & { key: string }>();
  for (const l of lines) {
    const employee = employeeOf(l);
    const month = monthOf(l.date);
    const key = `${l.date.slice(0, 7)} ${employee}`;
    const r = by.get(key) ?? { key, employee, month, orders: 0, products: 0, spend: 0, discount: 0, billed: 0 };
    r.orders++;
    r.products += (l.items ?? []).reduce((s, i) => s + i.quantity, 0);
    r.spend = round2(r.spend + l.spend);
    r.discount = round2(r.discount + l.discount);
    r.billed = round2(r.billed + billedOf(basis, l));
    by.set(key, r);
  }
  return [...by.values()]
    .sort((a, b) => a.key.localeCompare(b.key))
    .map((r) => ({ employee: r.employee, month: r.month, orders: r.orders, products: r.products, spend: r.spend, discount: r.discount, billed: r.billed }));
}

/** Everything on the invoice, one row per product line (for Excel). */
export function invoiceCsv(data: NonNullable<Awaited<ReturnType<typeof getInvoice>>>, from = "") {
  const { invoice, business, lines } = data;
  const basis = invoice.basis;
  const rows: (string | number)[][] = [
    ["Invoice", invoice.number],
    ["Issue date", ymd(invoice.createdAt)],
    ["From", from],
    ["Bill to", business?.name ?? invoice.businessName],
    ["Period", `${ymd(invoice.periodStart)} to ${lastDay({ to: invoice.periodEnd })}`],
    ["Billed on", basis === "spend" ? "Total your employees spent" : "Employee discount your employees received"],
    ["Currency", invoice.currency],
    ["Amount due", invoice.amount.toFixed(2)],
    [],
    [
      "Employee email",
      "Month",
      "Order",
      "Order date",
      "Product",
      "Variant",
      "SKU",
      "Quantity",
      "Unit price",
      "Line total",
      "Employee discount",
      "Employee paid",
      "Billed",
    ],
  ];
  for (const l of lines) {
    const items = l.items ?? [];
    if (!items.length) {
      rows.push([
        employeeOf(l), monthOf(l.date), l.orderName, l.date, "(items not recorded for this order)", "", "", "", "", "",
        l.discount.toFixed(2), l.spend.toFixed(2), billedOf(basis, l).toFixed(2),
      ]);
      continue;
    }
    for (const i of items) {
      rows.push([
        employeeOf(l), monthOf(l.date), l.orderName, l.date, i.title, i.variant, i.sku, i.quantity,
        i.unitPrice.toFixed(2), round2(i.unitPrice * i.quantity).toFixed(2), i.discount.toFixed(2), i.paid.toFixed(2),
        (basis === "spend" ? i.paid : i.discount).toFixed(2),
      ]);
    }
  }
  rows.push([]);
  rows.push(["Total", "", "", "", "", "", "", "", "", "", "", "", invoice.amount.toFixed(2)]);
  return toCsv(rows);
}
