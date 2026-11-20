import db from "../db.server";
import type { AdminClient } from "./admin-graphql.server";
import { gql } from "./admin-graphql.server";
import type { OrderItem } from "./usage";
import { fulfillmentFromAdmin, isPerksTitle, parseItems, round2 } from "./usage";
import { toCsv, ymd } from "./report";

export type Basis = "discount" | "spend";

export async function businessSummary(shop: string, from: Date, to: Date) {
  const [businesses, rows] = await Promise.all([
    db.business.findMany({ where: { shop }, orderBy: { createdAt: "asc" } }),
    db.orderUsage.findMany({
      where: { shop, cancelled: false, processedAt: { gte: from, lt: to } },
      select: { businessId: true, customerId: true, spend: true, total: true, discount: true, currency: true, fulfillment: true },
    }),
  ]);
  const currency = rows[0]?.currency ?? "PKR";
  const by = new Map<string, { orders: number; fulfilled: number; employees: Set<string>; spend: number; total: number; discount: number }>();
  for (const r of rows) {
    const x = by.get(r.businessId) ?? { orders: 0, fulfilled: 0, employees: new Set<string>(), spend: 0, total: 0, discount: 0 };
    x.orders++;
    if (r.fulfillment === "fulfilled") x.fulfilled++;
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
      fulfilled: x?.fulfilled ?? 0,
      employees: x?.employees.size ?? 0,
      spend: round2(x?.spend ?? 0),
      total: round2(x?.total ?? 0),
      discount: round2(x?.discount ?? 0),
    };
  });
  const totals = {
    ...lines.reduce(
      (t, l) => ({ orders: t.orders + l.orders, fulfilled: t.fulfilled + l.fulfilled, spend: round2(t.spend + l.spend), discount: round2(t.discount + l.discount) }),
      { orders: 0, fulfilled: 0, spend: 0, discount: 0 },
    ),
    // Different employees overall (one employee can't be in two businesses' totals twice).
    employees: new Set(rows.map((r) => r.customerId)).size,
  };
  return { currency, lines, totals };
}

export async function ordersFor(shop: string, businessId: string, from: Date, to: Date) {
  return db.orderUsage.findMany({
    where: { shop, businessId, cancelled: false, processedAt: { gte: from, lt: to } },
    orderBy: { processedAt: "asc" },
  });
}

/** Fills in line items for orders recorded before items were stored (from the Admin API), and saves them. Best effort. */
async function backfillItems(admin: AdminClient, rows: { id: string; orderId: string; items: string }[]) {
  // No items, or items from before product ids were kept (needed for Vendor and Type in Excel).
  const missing = rows.filter((r) => {
    const items = parseItems(r.items);
    return !items.length || items.some((i) => i.productId === undefined);
  });
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
                  vendor
                  product { id productType }
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
      vendor?: string | null;
      product?: { id: string; productType: string } | null;
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
      .filter((a) => isPerksTitle(a.discountApplication?.title ?? ""))
      .reduce((s, a) => s + (Number(a.allocatedAmountSet.shopMoney.amount) || 0), 0);
    return {
      title: li.title,
      variant: li.variantTitle ?? "",
      sku: li.sku ?? "",
      quantity: li.quantity,
      unitPrice,
      discount: round2(perks),
      paid: round2(Number(li.discountedTotalSet.shopMoney.amount) || 0),
      productId: li.product?.id.split("/").pop() ?? "",
      vendor: li.vendor ?? "",
      productType: li.product?.productType ?? "",
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


// ---------------------------------------------------------------------------------------------
// Monthly invoices (decision 018): one per business per month, worked out live from OrderUsage.
// Cancelled orders drop out; an order's billed amount is due once it's fulfilled.

export const monthKey = (d: Date) => d.toISOString().slice(0, 7);
export const monthStart = (key: string) => new Date(`${key}-01T00:00:00Z`);
export const nextMonth = (key: string) => {
  const d = monthStart(key);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1));
};
const MONTH_LONG = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
export const monthLabel = (key: string) => MONTH_LONG.format(monthStart(key));

export const billedOf = (basis: string, o: { spend: number; discount: number }) => (basis === "spend" ? o.spend : o.discount);
export const isDue = (o: { fulfillment: string }) => o.fulfillment === "fulfilled";

/**
 * Gives every business-month with orders an invoice number. Numbers follow the invoice month
 * (INV-202611-001, -002, …) in the order businesses first ordered that month, and never change.
 */
export async function ensureInvoices(shop: string) {
  const [orders, existing, businesses] = await Promise.all([
    db.orderUsage.findMany({
      where: { shop, cancelled: false },
      select: { businessId: true, processedAt: true },
      orderBy: { processedAt: "asc" },
    }),
    db.invoice.findMany({ where: { shop }, select: { businessId: true, month: true, number: true } }),
    db.business.findMany({ where: { shop }, select: { id: true, name: true } }),
  ]);
  const have = new Set(existing.map((i) => `${i.businessId} ${i.month}`));
  const used = new Map<string, number>();
  for (const i of existing) {
    const m = i.month;
    const n = Number(i.number.split("-").pop()) || 0;
    used.set(m, Math.max(used.get(m) ?? 0, n));
  }
  const names = new Map(businesses.map((b) => [b.id, b.name]));
  for (const o of orders) {
    const month = monthKey(o.processedAt);
    const key = `${o.businessId} ${month}`;
    if (have.has(key)) continue;
    have.add(key);
    const n = (used.get(month) ?? 0) + 1;
    used.set(month, n);
    try {
      await db.invoice.create({
        data: { shop, businessId: o.businessId, month, number: `INV-${month.replace("-", "")}-${String(n).padStart(3, "0")}`, businessName: names.get(o.businessId) ?? "" },
      });
    } catch {
      // Another request numbered it at the same time: theirs stands.
    }
  }
}

/** Looks up Shopify's fulfilment status for orders recorded before it was tracked. Best effort. */
export async function refreshUnknownFulfillment(admin: AdminClient, shop: string) {
  const rows = await db.orderUsage.findMany({ where: { shop, fulfillment: "unknown" }, select: { id: true, orderId: true }, take: 250 });
  for (let i = 0; i < rows.length; i += 50) {
    const batch = rows.slice(i, i + 50);
    try {
      const data = await gql<{ nodes: ({ id: string; displayFulfillmentStatus: string; cancelledAt: string | null } | null)[] }>(
        admin,
        `#graphql
        query PerksOrderStatus($ids: [ID!]!) {
          nodes(ids: $ids) { ... on Order { id displayFulfillmentStatus cancelledAt } }
        }`,
        { ids: batch.map((r) => `gid://shopify/Order/${r.orderId}`) },
      );
      for (const node of data.nodes) {
        if (!node?.id) continue;
        const row = batch.find((r) => node.id.endsWith(`/${r.orderId}`));
        if (!row) continue;
        await db.orderUsage.update({
          where: { id: row.id },
          data: { fulfillment: fulfillmentFromAdmin(node.displayFulfillmentStatus), ...(node.cancelledAt ? { cancelled: true } : {}) },
        });
      }
    } catch (err) {
      console.warn("[perks] couldn't load order fulfilment", err instanceof Error ? err.message : err);
    }
  }
}

export type InvoiceStatus = "open" | "waiting" | "ready";

export type InvoiceSummary = {
  id: string;
  number: string;
  businessId: string;
  business: string;
  month: string;
  monthLabel: string;
  billFor: string;
  currency: string;
  orders: number;
  fulfilled: number;
  /** Billed amount of orders not fulfilled yet */
  inProcess: number;
  /** Billed amount of fulfilled orders */
  due: number;
  /** open: the month isn't over · waiting: over, some orders not fulfilled · ready: over and all fulfilled */
  status: InvoiceStatus;
};

export function invoiceStatus(month: string, orders: number, fulfilled: number, now: Date): InvoiceStatus {
  if (now.getTime() < nextMonth(month).getTime()) return "open";
  return fulfilled < orders ? "waiting" : "ready";
}

/** Monthly invoices, newest month first. months: inclusive "YYYY-MM" bounds. Invoices whose orders were all cancelled are left out. */
export async function listMonthlyInvoices(
  shop: string,
  filter: { businessId?: string | null; fromMonth?: string | null; toMonth?: string | null } = {},
  now = new Date(),
): Promise<InvoiceSummary[]> {
  const from = filter.fromMonth ? monthStart(filter.fromMonth) : undefined;
  const to = filter.toMonth ? nextMonth(filter.toMonth) : undefined;
  const [invoices, businesses, rows] = await Promise.all([
    db.invoice.findMany({ where: { shop, ...(filter.businessId ? { businessId: filter.businessId } : {}) } }),
    db.business.findMany({ where: { shop }, select: { id: true, name: true, billFor: true, archivedAt: true } }),
    db.orderUsage.findMany({
      where: {
        shop,
        cancelled: false,
        ...(filter.businessId ? { businessId: filter.businessId } : {}),
        ...(from || to ? { processedAt: { ...(from ? { gte: from } : {}), ...(to ? { lt: to } : {}) } } : {}),
      },
      select: { businessId: true, processedAt: true, spend: true, discount: true, currency: true, fulfillment: true },
    }),
  ]);
  const biz = new Map(businesses.map((b) => [b.id, b]));
  const by = new Map<string, typeof rows>();
  for (const r of rows) {
    const k = `${r.businessId} ${monthKey(r.processedAt)}`;
    by.set(k, [...(by.get(k) ?? []), r]);
  }
  const out: InvoiceSummary[] = [];
  for (const inv of invoices) {
    const orders = by.get(`${inv.businessId} ${inv.month}`);
    if (!orders?.length) continue;
    const b = biz.get(inv.businessId);
    const billFor = b?.billFor ?? "discount";
    const fulfilled = orders.filter(isDue).length;
    out.push({
      id: inv.id,
      number: inv.number,
      businessId: inv.businessId,
      business: b ? `${b.name}${b.archivedAt ? " (deleted)" : ""}` : inv.businessName,
      month: inv.month,
      monthLabel: monthLabel(inv.month),
      billFor,
      currency: orders[0].currency,
      orders: orders.length,
      fulfilled,
      inProcess: round2(orders.filter((o) => !isDue(o)).reduce((s, o) => s + billedOf(billFor, o), 0)),
      due: round2(orders.filter(isDue).reduce((s, o) => s + billedOf(billFor, o), 0)),
      status: invoiceStatus(inv.month, orders.length, fulfilled, now),
    });
  }
  return out.sort((a, b) => b.month.localeCompare(a.month) || a.number.localeCompare(b.number));
}

/** One billed order on an invoice. */
export type InvoiceLine = {
  orderName: string;
  date: string;
  customerId: string;
  email: string;
  fulfillment: string;
  spend: number;
  discount: number;
  items: OrderItem[];
};

/** A monthly invoice with its live orders. admin: fills in missing item details (vendor, type) from Shopify. */
export async function getMonthlyInvoice(shop: string, id: string, admin?: AdminClient | null, now = new Date()) {
  const invoice = await db.invoice.findFirst({ where: { shop, id } });
  if (!invoice) return null;
  const business = await db.business.findFirst({ where: { shop, id: invoice.businessId } });
  const orders = await ordersFor(shop, invoice.businessId, monthStart(invoice.month), nextMonth(invoice.month));
  if (admin) {
    await backfillItems(admin, orders);
    await fillProductTypes(admin, orders);
  }
  const emails = await emailsFor(shop, orders.map((o) => o.customerId));
  const lines: InvoiceLine[] = orders.map((o) => ({
    orderName: o.orderName,
    date: ymd(o.processedAt),
    customerId: o.customerId,
    email: emails.get(o.customerId) || o.email || "",
    fulfillment: o.fulfillment,
    spend: o.spend,
    discount: o.discount,
    items: parseItems(o.items),
  }));
  const billFor = business?.billFor ?? "discount";
  const fulfilled = lines.filter(isDue).length;
  return {
    invoice,
    business,
    billFor,
    currency: orders[0]?.currency ?? "PKR",
    lines,
    due: round2(lines.filter(isDue).reduce((s, l) => s + billedOf(billFor, l), 0)),
    inProcess: round2(lines.filter((l) => !isDue(l)).reduce((s, l) => s + billedOf(billFor, l), 0)),
    status: invoiceStatus(invoice.month, lines.length, fulfilled, now),
  };
}

/** Product type for items recorded from webhooks (the order payload has the vendor but not the type). Best effort. */
async function fillProductTypes(admin: AdminClient, rows: { id: string; items: string }[]) {
  const ids = [
    ...new Set(rows.flatMap((r) => parseItems(r.items).filter((i) => i.productId && i.productType === undefined).map((i) => i.productId!))),
  ];
  if (!ids.length) return;
  const types = new Map<string, { type: string; vendor: string }>();
  for (let i = 0; i < ids.length; i += 100) {
    try {
      const data = await gql<{ nodes: ({ id: string; productType: string; vendor: string } | null)[] }>(
        admin,
        `#graphql
        query PerksProductTypes($ids: [ID!]!) { nodes(ids: $ids) { ... on Product { id productType vendor } } }`,
        { ids: ids.slice(i, i + 100).map((id) => `gid://shopify/Product/${id}`) },
      );
      for (const n of data.nodes) if (n?.id) types.set(n.id.split("/").pop()!, { type: n.productType, vendor: n.vendor });
    } catch (err) {
      console.warn("[perks] couldn't load product types for invoice", err instanceof Error ? err.message : err);
      return;
    }
  }
  for (const r of rows) {
    const items = parseItems(r.items);
    if (!items.some((i) => i.productId && i.productType === undefined)) continue;
    const next = items.map((i) => {
      if (!i.productId || i.productType !== undefined) return i;
      const t = types.get(i.productId);
      // Deleted products: "" so we don't ask again.
      return { ...i, productType: t?.type ?? "", vendor: i.vendor || t?.vendor || "" };
    });
    r.items = JSON.stringify(next);
    await db.orderUsage.update({ where: { id: r.id }, data: { items: r.items } });
  }
}

const employeeOf = (l: { email: string }) => l.email || "Employee (email not recorded)";
export const STATUS_LABEL: Record<string, string> = {
  fulfilled: "Fulfilled",
  partial: "Partly fulfilled",
  unfulfilled: "Unfulfilled",
  unknown: "Checking with Shopify",
};

export type EmployeeRow = {
  employee: string;
  orders: number;
  fulfilled: number;
  products: number;
  spend: number;
  discount: number;
  inProcess: number;
  due: number;
};

/** The invoice table: one row per employee. */
export function employeeRows(lines: InvoiceLine[], billFor: string): EmployeeRow[] {
  const by = new Map<string, EmployeeRow>();
  for (const l of lines) {
    const employee = employeeOf(l);
    const r = by.get(employee) ?? { employee, orders: 0, fulfilled: 0, products: 0, spend: 0, discount: 0, inProcess: 0, due: 0 };
    r.orders++;
    if (isDue(l)) r.fulfilled++;
    r.products += l.items.reduce((s, i) => s + i.quantity, 0);
    r.spend = round2(r.spend + l.spend);
    r.discount = round2(r.discount + l.discount);
    if (isDue(l)) r.due = round2(r.due + billedOf(billFor, l));
    else r.inProcess = round2(r.inProcess + billedOf(billFor, l));
    by.set(employee, r);
  }
  return [...by.values()].sort((a, b) => a.employee.localeCompare(b.employee));
}

type InvoiceData = NonNullable<Awaited<ReturnType<typeof getMonthlyInvoice>>>;

/** Everything on the invoice, one row per product line (for Excel). */
export function invoiceCsv(data: InvoiceData, from = "") {
  const { invoice, business, lines, billFor } = data;
  const businessName = business?.name ?? invoice.businessName;
  const month = monthLabel(invoice.month);
  const rows: (string | number)[][] = [
    ["Invoice", invoice.number],
    ["From", from],
    ["Bill to", businessName],
    ["Month", month],
    ["Billed for", billFor === "spend" ? "Total your employees spent" : "Employee discount your employees received"],
    ["Currency", data.currency],
    ["Amount due (fulfilled orders)", data.due.toFixed(2)],
    ["In process (not fulfilled yet)", data.inProcess.toFixed(2)],
    [],
    [
      "Invoice",
      "Business",
      "Employee email",
      "Month",
      "Order",
      "Order date",
      "Order status",
      "Product",
      "Variant",
      "SKU",
      "Vendor",
      "Type",
      "Quantity",
      "Unit price",
      "Line total",
      "Employee discount",
      "Employee paid",
      "Billed",
      "Due now",
    ],
  ];
  for (const l of lines) {
    const head = [invoice.number, businessName, employeeOf(l), month, l.orderName, l.date, STATUS_LABEL[l.fulfillment] ?? l.fulfillment];
    const due = isDue(l) ? "Yes" : "No";
    if (!l.items.length) {
      rows.push([...head, "(items not recorded for this order)", "", "", "", "", "", "", "", l.discount.toFixed(2), l.spend.toFixed(2), billedOf(billFor, l).toFixed(2), due]);
      continue;
    }
    for (const i of l.items) {
      rows.push([
        ...head, i.title, i.variant, i.sku, i.vendor ?? "", i.productType ?? "", i.quantity,
        i.unitPrice.toFixed(2), round2(i.unitPrice * i.quantity).toFixed(2), i.discount.toFixed(2), i.paid.toFixed(2),
        (billFor === "spend" ? i.paid : i.discount).toFixed(2), due,
      ]);
    }
  }
  rows.push([]);
  rows.push(["Amount due", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", data.due.toFixed(2)]);
  return toCsv(rows);
}
