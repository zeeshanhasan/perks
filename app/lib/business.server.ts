import type { Business } from "@prisma/client";
import db from "../db.server";
import type { BusinessInput } from "./business";
import { emailDomain, normalizeEmail } from "./domain";
import { parseJsonList } from "./policy";
import type { Targeting } from "./targeting";
import { EMPTY_TARGET, parseTargeting } from "./targeting";

export type BusinessView = Omit<Business, "domains" | "discountTarget" | "employeeOnlyTarget"> & {
  domains: string[];
  discountTarget: Targeting;
  employeeOnlyTarget: Targeting;
};

export function view(b: Business): BusinessView {
  return {
    ...b,
    domains: parseJsonList(b.domains),
    discountTarget: parseTargeting(b.discountTarget),
    employeeOnlyTarget: parseTargeting(b.employeeOnlyTarget),
  };
}

/**
 * One-time migration from the v1 single-employer model: Employer + BenefitPolicy → one Business.
 * Existing link-verified memberships are attached to it. Idempotent.
 */
export async function migrateLegacy(shop: string) {
  if (await db.business.count({ where: { shop } })) return;
  const [employer, policy] = await Promise.all([
    db.employer.findUnique({ where: { shop } }),
    db.benefitPolicy.findUnique({ where: { shop } }),
  ]);
  if (!employer?.name || !policy) return;
  const ids = (raw: string | null | undefined) => parseJsonList(raw).map((id) => ({ id, title: "" }));
  const all = policy.discountScope === "all_products";
  const b = await db.business.create({
    data: {
      shop,
      name: employer.name,
      domains: employer.domains,
      discountType: "percentage",
      discountValue: policy.discountPercent,
      discountTarget: JSON.stringify({ ...EMPTY_TARGET, all, products: all ? [] : ids(policy.discountedProducts) }),
      employeeOnlyTarget: JSON.stringify({ ...EMPTY_TARGET, products: ids(policy.employeeOnlyProducts) }),
    },
  });
  await db.employeeMembership.updateMany({ where: { shop, businessId: null }, data: { businessId: b.id } });
}

export async function listBusinesses(shop: string): Promise<BusinessView[]> {
  await migrateLegacy(shop);
  const rows = await db.business.findMany({ where: { shop }, orderBy: { createdAt: "asc" } });
  return rows.map(view);
}

export async function getBusiness(shop: string, id: string): Promise<BusinessView | null> {
  const b = await db.business.findFirst({ where: { shop, id } });
  return b ? view(b) : null;
}

export function businessData(i: BusinessInput) {
  return {
    name: i.name,
    domains: JSON.stringify(i.domains),
    discountType: i.discountType,
    discountValue: i.discountValue,
    discountTarget: JSON.stringify(i.discountTarget),
    employeeOnlyTarget: JSON.stringify(i.employeeOnlyTarget),
    limitPeriod: i.limitPeriod,
    limitBasis: i.limitBasis,
    limitAmount: i.limitAmount,
    billingEmail: i.billingEmail,
    billingAddress: i.billingAddress,
    active: i.active,
  };
}

/** Domains already used by another business in this shop (a domain can belong to one business). */
export async function domainConflicts(shop: string, domains: string[], exceptId?: string) {
  const others = await db.business.findMany({ where: { shop, ...(exceptId ? { NOT: { id: exceptId } } : {}) } });
  const taken: string[] = [];
  for (const o of others) for (const d of parseJsonList(o.domains)) if (domains.includes(d)) taken.push(`${d} (${o.name})`);
  return taken;
}

/** Active business whose domains include the email's domain. */
export async function businessForEmail(shop: string, email: string | null | undefined) {
  const e = email ? normalizeEmail(email) : null;
  if (!e) return null;
  const d = emailDomain(e);
  const rows = await db.business.findMany({ where: { shop, active: true } });
  const b = rows.find((r) => parseJsonList(r.domains).includes(d));
  return b ? view(b) : null;
}

export async function allActiveDomains(shop: string) {
  const rows = await db.business.findMany({ where: { shop, active: true } });
  return rows.flatMap((r) => parseJsonList(r.domains));
}
