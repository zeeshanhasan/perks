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
  discount_applications?: Array<{ type?: string; title?: string; description?: string | null }>;
  line_items?: Array<{ discount_allocations?: Array<{ amount?: Money; discount_application_index?: number }> }>;
};

const num = (m: Money) => {
  const n = Number(m ?? 0);
  return Number.isFinite(n) ? n : 0;
};
export const round2 = (n: number) => Math.round(n * 100) / 100;

function isPerks(app: { type?: string; title?: string; description?: string | null } | undefined) {
  if (!app) return false;
  const t = `${app.title ?? ""} ${app.description ?? ""}`;
  return PERKS_DISCOUNT_TITLES.some((x) => t.includes(x)) || /Employee price/.test(t);
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
