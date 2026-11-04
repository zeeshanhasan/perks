/**
 * Shared Function logic (copied into each Function so they bundle independently; a test asserts
 * the copies are identical). Fail closed everywhere.
 *
 * Buyer's business:
 *   logged in AND not revoked AND (
 *     active, unexpired link-verification metafield (carries businessId), or
 *     auto-domain on and ACCOUNT email domain belongs to a business )
 * The checkout contact email is never used: guests can type anything.
 */
type Meta = { value: string } | null | undefined;

export type Buyer =
  | { isAuthenticated?: boolean | null; customer?: { email?: string | null; eligibility?: Meta; usage?: Meta } | null }
  | null
  | undefined;

export type Target = { all: boolean; productIds: string[]; collectionIds: string[]; vendors: string[]; types: string[] };
export type Limit = { period: "month" | "year"; basis: "discount" | "spend"; amount: number } | null;
export type Business = {
  id: string;
  domains: string[];
  type: "percentage" | "fixed";
  value: number;
  target: Target;
  employeeOnly: Target;
  limit: Limit;
};
export type Config = { autoDomain: boolean; excluded: string[]; businesses: Business[] };

export type ProductInput = {
  id?: string | null;
  vendor?: string | null;
  productType?: string | null;
  inCollections?: Array<{ collectionId: string; isMember: boolean }> | null;
  employeeOnly?: Meta;
};

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const arr = (v: unknown) => (Array.isArray(v) ? v : []);
const strs = (v: unknown, lower = false) =>
  arr(v)
    .filter((s): s is string => typeof s === "string")
    .map((s) => (lower ? s.toLowerCase() : s));

function parseTarget(v: unknown): Target {
  const o = (v ?? {}) as Record<string, unknown>;
  return {
    all: o.all === true,
    productIds: strs(o.productIds),
    collectionIds: strs(o.collectionIds),
    vendors: strs(o.vendors, true),
    types: strs(o.types, true),
  };
}

function parseLimit(v: unknown): Limit {
  const o = (v ?? null) as Record<string, unknown> | null;
  if (!o) return null;
  const amount = Number(o.amount);
  if ((o.period !== "month" && o.period !== "year") || !(amount > 0)) return null;
  return { period: o.period, basis: o.basis === "spend" ? "spend" : "discount", amount };
}

/** Parses the v2 config. Returns null on anything malformed (callers fail closed). */
export function parseConfig(raw: string | null | undefined): Config | null {
  if (!raw) return null;
  let c: Record<string, unknown>;
  try {
    c = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!c || c.v !== 2) return null;
  const businesses: Business[] = [];
  for (const b of arr(c.businesses) as Record<string, unknown>[]) {
    const value = Number(b?.value);
    const type = b?.type === "fixed" ? "fixed" : "percentage";
    if (typeof b?.id !== "string") continue;
    if (type === "percentage" ? !(value >= 1 && value <= 90) : !(value > 0)) continue;
    businesses.push({
      id: b.id,
      domains: strs(b.domains, true),
      type,
      value,
      target: parseTarget(b.target),
      employeeOnly: { ...parseTarget(b.employeeOnly), all: false },
      limit: parseLimit(b.limit),
    });
  }
  return { autoDomain: c.autoDomain === true, excluded: strs(c.excluded), businesses };
}

type Eligibility = { status: "active"; expiresAt: string | null; businessId: string | null } | { status: "revoked" } | null;

export function parseEligibility(raw: string | null | undefined): Eligibility {
  if (!raw) return null;
  let o: Record<string, unknown>;
  try {
    o = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!o || typeof o !== "object" || o.v !== 1) return null;
  if (o.status === "revoked") return { status: "revoked" };
  if (o.status !== "active") return null;
  const businessId = typeof o.businessId === "string" ? o.businessId : null;
  if (o.expiresAt === null) return { status: "active", expiresAt: null, businessId };
  if (typeof o.expiresAt === "string" && DATE.test(o.expiresAt)) return { status: "active", expiresAt: o.expiresAt, businessId };
  return null;
}

export function emailDomain(email: string | null | undefined): string | null {
  if (typeof email !== "string") return null;
  const e = email.trim().toLowerCase();
  const at = e.lastIndexOf("@");
  if (at <= 0 || at !== e.indexOf("@")) return null;
  return e.slice(at + 1) || null;
}

/** The business whose perks this buyer gets, or null. */
export function resolveBusiness(buyer: Buyer, config: Config, today: string): Business | null {
  const customer = buyer?.customer;
  if (!customer || buyer?.isAuthenticated === false || !config.businesses.length) return null;
  const e = parseEligibility(customer.eligibility?.value);
  if (e?.status === "revoked") return null;
  if (e?.status === "active" && (e.expiresAt === null || (typeof today === "string" && today.slice(0, 10) < e.expiresAt))) {
    // Legacy single-employer rows have no businessId: they belong to the first business.
    const b = e.businessId ? config.businesses.find((x) => x.id === e.businessId) : config.businesses[0];
    if (b) return b;
  }
  if (config.autoDomain) {
    const d = emailDomain(customer.email);
    if (d) return config.businesses.find((b) => b.domains.includes(d)) ?? null;
  }
  return null;
}

export function matches(p: ProductInput, t: Target): boolean {
  if (t.all) return true;
  if (p.id && t.productIds.includes(p.id)) return true;
  if (p.vendor && t.vendors.includes(p.vendor.toLowerCase())) return true;
  if (p.productType && t.types.includes(p.productType.toLowerCase())) return true;
  if (t.collectionIds.length && p.inCollections)
    return p.inCollections.some((c) => c.isMember && t.collectionIds.includes(c.collectionId));
  return false;
}

/** Usage so far this period (from the customer's perks_usage metafield). */
export function usedInPeriod(usageRaw: string | null | undefined, b: Business, today: string): number {
  if (!b.limit) return 0;
  let u: Record<string, unknown>;
  try {
    u = JSON.parse(usageRaw || "{}");
  } catch {
    return Number.POSITIVE_INFINITY; // unreadable usage: fail closed
  }
  const key = b.limit.period === "month" ? today.slice(0, 7) : today.slice(0, 4);
  const stored = b.limit.period === "month" ? u.m : u.y;
  if (stored !== key) return 0;
  const per = ((u.b as Record<string, Record<string, number>> | undefined) ?? {})[b.id] ?? {};
  const field = (b.limit.period === "month" ? "m" : "y") + (b.limit.basis === "spend" ? "s" : "d");
  const n = Number(per[field] ?? 0);
  return Number.isFinite(n) ? n : Number.POSITIVE_INFINITY;
}

export function withinLimit(usageRaw: string | null | undefined, b: Business, today: string): boolean {
  return !b.limit || usedInPeriod(usageRaw, b, today) < b.limit.amount;
}
