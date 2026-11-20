import db from "../db.server";
import { formatMoney } from "./business";
import { toCsv } from "./report";
import { buildUsage, round2 } from "./usage";

export const EMPLOYEE_STATUSES = ["active", "revoked", "expired", "inactive"] as const;
export const SORTS = ["newest", "orders", "limit"] as const;
export type EmployeeSort = (typeof SORTS)[number];

export type EmployeeFilter = { q: string; status: string; businessId: string; sort: EmployeeSort };

export function parseEmployeeFilter(params: URLSearchParams): EmployeeFilter {
  const sort = params.get("sort");
  return {
    q: (params.get("q") ?? "").trim().toLowerCase(),
    status: params.get("status") ?? "all",
    businessId: params.get("business") ?? "all",
    sort: (SORTS as readonly string[]).includes(sort ?? "") ? (sort as EmployeeSort) : "newest",
  };
}

export type EmployeeLimit = {
  period: string;
  basis: string;
  amount: number;
  used: number;
  /** 0–1: share of the limit used */
  share: number;
};

export type EmployeeRow = {
  customerId: string;
  workEmail: string;
  source: string;
  businessId: string | null;
  business: string;
  businessDeleted: boolean;
  status: string;
  joined: Date;
  orders: number;
  spend: number;
  discount: number;
  limit: EmployeeLimit | null;
};

/**
 * Employees matching the filter, with their orders (all time, not cancelled) and this month's/year's use of
 * their business's limit. Sorted, not paginated. counts: per status, ignoring the status filter (for the tabs).
 */
export async function listEmployees(shop: string, f: EmployeeFilter, now = new Date()) {
  const base = {
    shop,
    ...(f.businessId !== "all" ? { businessId: f.businessId } : {}),
    ...(f.q ? { OR: [{ workEmail: { contains: f.q } }, { customerId: { contains: f.q } }] } : {}),
  };
  const yearStart = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
  const [members, byStatus, businesses, totals, yearRows] = await Promise.all([
    db.employeeMembership.findMany({
      where: { ...base, ...(f.status !== "all" ? { status: f.status } : {}) },
      orderBy: [{ verifiedAt: "desc" }, { id: "desc" }],
    }),
    db.employeeMembership.groupBy({ by: ["status"], where: base, _count: true }),
    db.business.findMany({
      where: { shop },
      select: { id: true, name: true, archivedAt: true, limitPeriod: true, limitBasis: true, limitAmount: true },
    }),
    db.orderUsage.groupBy({
      by: ["customerId"],
      where: { shop, cancelled: false },
      _count: true,
      _sum: { spend: true, discount: true },
    }),
    db.orderUsage.findMany({
      where: { shop, cancelled: false, processedAt: { gte: yearStart } },
      select: { customerId: true, businessId: true, processedAt: true, spend: true, discount: true },
    }),
  ]);
  const biz = new Map(businesses.map((b) => [b.id, b]));
  const orderTotals = new Map(totals.map((t) => [t.customerId, t]));
  const rowsByCustomer = new Map<string, typeof yearRows>();
  for (const r of yearRows) rowsByCustomer.set(r.customerId, [...(rowsByCustomer.get(r.customerId) ?? []), r]);

  const rows: EmployeeRow[] = members.map((m) => {
    const b = m.businessId ? biz.get(m.businessId) : undefined;
    const t = orderTotals.get(m.customerId);
    let limit: EmployeeLimit | null = null;
    if (b && b.limitPeriod !== "none" && b.limitAmount) {
      const u = buildUsage(rowsByCustomer.get(m.customerId) ?? [], now).b[b.id] ?? { md: 0, ms: 0, yd: 0, ys: 0 };
      const used = b.limitPeriod === "month" ? (b.limitBasis === "spend" ? u.ms : u.md) : b.limitBasis === "spend" ? u.ys : u.yd;
      limit = { period: b.limitPeriod, basis: b.limitBasis, amount: b.limitAmount, used, share: Math.min(1, used / b.limitAmount) };
    }
    return {
      customerId: m.customerId,
      workEmail: m.workEmail,
      source: m.source,
      businessId: m.businessId,
      // Deleted (archived) businesses read as "Deleted business" so their employees can't be restored to them.
      business: m.businessId ? (b && !b.archivedAt ? b.name : "Deleted business") : "",
      businessDeleted: Boolean(m.businessId && (!b || b.archivedAt)),
      status: m.status,
      joined: m.verifiedAt,
      orders: t?._count ?? 0,
      spend: round2(t?._sum.spend ?? 0),
      discount: round2(t?._sum.discount ?? 0),
      limit,
    };
  });

  if (f.sort === "orders") rows.sort((a, b) => b.orders - a.orders || b.spend - a.spend);
  if (f.sort === "limit") rows.sort((a, b) => (b.limit?.share ?? -1) - (a.limit?.share ?? -1));

  const counts: Record<string, number> = { all: 0 };
  for (const s of byStatus) {
    counts[s.status] = s._count;
    counts.all += s._count;
  }
  return { rows, counts };
}

const STATUS_TEXT: Record<string, string> = {
  active: "Active",
  revoked: "Removed",
  expired: "Expired",
  inactive: "Not eligible",
};

const ymd = (d: Date) => d.toISOString().slice(0, 10);

/** The employee list for Excel. */
export function employeesCsv(rows: EmployeeRow[], currency: string) {
  const out: (string | number)[][] = [
    [
      "Employee email",
      "Business",
      "Status",
      "Joined",
      "Joined by",
      "Orders",
      `Spend (${currency})`,
      `Discount (${currency})`,
      "Limit",
      "Limit used",
      "Shopify customer ID",
    ],
  ];
  for (const r of rows) {
    out.push([
      r.workEmail,
      r.business,
      STATUS_TEXT[r.status] ?? r.status,
      ymd(r.joined),
      r.source === "domain" ? "Work email" : "Email link",
      r.orders,
      r.spend.toFixed(2),
      r.discount.toFixed(2),
      r.limit ? `${formatMoney(r.limit.amount, currency)} ${r.limit.basis} per ${r.limit.period}` : "No limit",
      r.limit ? r.limit.used.toFixed(2) : "",
      r.customerId,
    ]);
  }
  return toCsv(out);
}
