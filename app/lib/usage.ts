/**
 * Pure helpers for order usage (no DB). Used by the orders webhook and tests.
 */
export const PERKS_DISCOUNT_TITLES = ["Employee perks"];

type Money = string | number | null | undefined;
type OrderPayload = {
  id?: number | string;
  name?: string;
  processed_at?: string | null;
  created_at?: string | null;
  currency?: string;
  subtotal_price?: Money;
  total_price?: Money;
  customer?: { id?: number | string; email?: string | null } | null;
  email?: string | null;
  fulfillment_status?: string | null;
  cancelled_at?: string | null;
  discount_applications?: Array<{ type?: string; title?: string; description?: string | null }>;
  line_items?: Array<{
    title?: string | null;
    variant_title?: string | null;
    sku?: string | null;
    quantity?: number | null;
    price?: Money;
    product_id?: number | string | null;
    vendor?: string | null;
    discount_allocations?: Array<{ amount?: Money; discount_application_index?: number }>;
  }>;
};

/** One product line of an employee order, kept for itemised invoices. Money in the order's currency. */
export type OrderItem = {
  title: string;
  variant: string;
  sku: string;
  quantity: number;
  /** Price of one unit before any discount */
  unitPrice: number;
  /** Employee discount on this line (all units) */
  discount: number;
  /** What the employee paid for this line, after all discounts */
  paid: number;
  /** Missing on orders recorded before 2026-11-20. productType is looked up from Shopify when an invoice is exported. */
  productId?: string;
  vendor?: string;
  productType?: string;
};

/** Line items from the orders/create REST payload. */
export function orderItems(order: OrderPayload): OrderItem[] {
  const apps = order.discount_applications ?? [];
  return (order.line_items ?? []).map((li) => {
    const quantity = Math.max(0, Math.floor(num(li.quantity ?? 0)));
    const unitPrice = round2(num(li.price));
    let perks = 0;
    let all = 0;
    for (const a of li.discount_allocations ?? []) {
      all += num(a.amount);
      if (isPerks(apps[a.discount_application_index ?? -1])) perks += num(a.amount);
    }
    return {
      title: (li.title ?? "").slice(0, 255),
      variant: (li.variant_title ?? "").slice(0, 255),
      sku: (li.sku ?? "").slice(0, 100),
      quantity,
      unitPrice,
      discount: round2(perks),
      paid: round2(unitPrice * quantity - all),
      productId: li.product_id != null ? String(li.product_id) : "",
      vendor: (li.vendor ?? "").slice(0, 255),
    };
  });
}

/** Parses stored items JSON; [] when missing or broken. */
export function parseItems(raw: string | null | undefined): OrderItem[] {
  try {
    const v = JSON.parse(raw ?? "[]");
    return Array.isArray(v) ? (v as OrderItem[]) : [];
  } catch {
    return [];
  }
}

const num = (m: Money) => {
  const n = Number(m ?? 0);
  return Number.isFinite(n) ? n : 0;
};
export const round2 = (n: number) => Math.round(n * 100) / 100;

/** Our discount's title at checkout: "Employee perks", or the storefront label ("Employee price (15% off)"). */
export function isPerksTitle(t: string) {
  return PERKS_DISCOUNT_TITLES.some((x) => t.includes(x)) || /Employee price/.test(t);
}

function isPerks(app: { type?: string; title?: string; description?: string | null } | undefined) {
  if (!app) return false;
  return isPerksTitle(`${app.title ?? ""} ${app.description ?? ""}`);
}

/** Total of our employee discount on an order, from the REST webhook payload. */
export function perksDiscountOf(order: OrderPayload): number {
  const apps = order.discount_applications ?? [];
  let total = 0;
  for (const li of order.line_items ?? [])
    for (const a of li.discount_allocations ?? [])
      if (isPerks(apps[a.discount_application_index ?? -1])) total += num(a.amount);
  return round2(total);
}

export type Fulfillment = "unfulfilled" | "partial" | "fulfilled" | "unknown";

/** REST fulfillment_status (null, "partial", "fulfilled", "restocked") → ours. */
export function fulfillmentOf(status: string | null | undefined): Fulfillment {
  if (status === "fulfilled") return "fulfilled";
  if (status === "partial") return "partial";
  return "unfulfilled";
}

/** GraphQL displayFulfillmentStatus → ours. */
export function fulfillmentFromAdmin(status: string | null | undefined): Fulfillment {
  if (status === "FULFILLED") return "fulfilled";
  if (status === "PARTIALLY_FULFILLED") return "partial";
  return status ? "unfulfilled" : "unknown";
}

export function orderSummary(order: OrderPayload) {
  return {
    orderId: String(order.id ?? ""),
    orderName: order.name ?? String(order.id ?? ""),
    processedAt: new Date(order.processed_at || order.created_at || Date.now()),
    currency: order.currency ?? "PKR",
    spend: round2(num(order.subtotal_price)),
    total: round2(num(order.total_price)),
    discount: perksDiscountOf(order),
    customerId: order.customer?.id != null ? String(order.customer.id) : null,
    email: order.customer?.email ?? order.email ?? null,
    fulfillment: fulfillmentOf(order.fulfillment_status),
    cancelled: Boolean(order.cancelled_at),
  };
}

/** Period keys in the shop's sense of "now" (UTC is close enough for monthly/yearly caps). */
export function periodKeys(d: Date) {
  const iso = d.toISOString();
  return { month: iso.slice(0, 7), year: iso.slice(0, 4) };
}

export type UsageValue = {
  v: 1;
  m: string;
  y: string;
  b: Record<string, { md: number; ms: number; yd: number; ys: number }>;
};

export function buildUsage(
  rows: { businessId: string; processedAt: Date; spend: number; discount: number }[],
  now: Date,
): UsageValue {
  const { month, year } = periodKeys(now);
  const b: UsageValue["b"] = {};
  for (const r of rows) {
    const k = periodKeys(r.processedAt);
    if (k.year !== year) continue;
    const x = (b[r.businessId] ??= { md: 0, ms: 0, yd: 0, ys: 0 });
    x.yd = round2(x.yd + r.discount);
    x.ys = round2(x.ys + r.spend);
    if (k.month === month) {
      x.md = round2(x.md + r.discount);
      x.ms = round2(x.ms + r.spend);
    }
  }
  return { v: 1, m: month, y: year, b };
}
