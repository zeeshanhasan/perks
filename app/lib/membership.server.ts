import db from "../db.server";
import type { AdminClient } from "./admin-graphql.server";
import { gql } from "./admin-graphql.server";
import { migrateLegacy } from "./business.server";
import { audit } from "./audit.server";
import { emailDomain, isApprovedEmail, maskEmail, normalizeEmail } from "./domain";
import { REVOKED_VALUE, buildEligibilityValue, computeExpiry, isExpired } from "./eligibility";
import { clearEligibility, publishEligibility } from "./metafields.server";
import { parseJsonList } from "./policy";

export async function getProgram(shop: string) {
  await migrateLegacy(shop);
  const [businesses, policy] = await Promise.all([
    db.business.findMany({ where: { shop, active: true, archivedAt: null }, orderBy: { createdAt: "asc" } }),
    db.benefitPolicy.findUnique({ where: { shop } }),
  ]);
  return {
    enabled: Boolean(policy?.enabled && businesses.length),
    /** Display name: the business when there's only one, otherwise generic. */
    employerName: businesses.length === 1 ? businesses[0].name : "your company",
    businesses: businesses.map((b) => ({ id: b.id, name: b.name, domains: parseJsonList(b.domains) })),
    domains: businesses.flatMap((b) => parseJsonList(b.domains)),
    eligibilityMonths: policy?.eligibilityMonths ?? null,
    autoDomain: policy?.autoDomain ?? true,
  };
}

/** Account email of a customer (needs protected customer data: email). null if unavailable. */
export async function getCustomerEmail(admin: AdminClient, customerId: string): Promise<string | null> {
  try {
    const data = await gql(admin, `#graphql
      query PerksCustomerEmail($id: ID!) { customer(id: $id) { defaultEmailAddress { emailAddress } } }`, {
      id: `gid://shopify/Customer/${customerId}`,
    });
    return data.customer?.defaultEmailAddress?.emailAddress ?? null;
  } catch (err) {
    console.warn("[perks] could not read customer email", err);
    return null;
  }
}

type Program = Awaited<ReturnType<typeof getProgram>>;

/** The business whose domains include this email, if any. */
export function businessOf(program: Pick<Program, "businesses">, email: string | null | undefined) {
  const e = email ? normalizeEmail(email) : null;
  if (!e) return null;
  const d = emailDomain(e);
  return program.businesses.find((b) => b.domains.includes(d)) ?? null;
}

/** True when the customer is eligible automatically via their account email domain. */
export function isDomainEligible(program: { autoDomain: boolean; domains: string[] }, accountEmail: string | null) {
  return Boolean(program.autoDomain && accountEmail && isApprovedEmail(accountEmail, program.domains));
}

export async function getMembership(shop: string, customerId: string) {
  return db.employeeMembership.findUnique({ where: { shop_customerId: { shop, customerId } } });
}

/** Another customer already holds an active membership with this work email. */
export async function revokeMembership(admin: AdminClient, shop: string, customerId: string, actor: string) {
  const m = await getMembership(shop, customerId);
  if (!m) return false;
  await db.employeeMembership.update({
    where: { id: m.id },
    data: { status: "revoked", revokedAt: new Date() },
  });
  // Explicit "revoked" value (not a delete) so it also overrides domain auto-eligibility.
  await publishEligibility(admin, customerId, REVOKED_VALUE);
  await audit({ shop, actor, action: "membership.revoke", subject: customerId, result: "ok" });
  return true;
}

export async function reactivateMembership(admin: AdminClient, shop: string, customerId: string, actor: string) {
  const m = await getMembership(shop, customerId);
  if (!m) return false;
  // Their business was deleted: there's nothing to restore them to. They can verify again (or match a domain) instead.
  if (m.businessId) {
    const b = await db.business.findFirst({ where: { shop, id: m.businessId }, select: { archivedAt: true } });
    if (!b || b.archivedAt) return "business_deleted" as const;
  }
  const program = await getProgram(shop);
  const now = new Date();
  if (m.source === "domain") {
    // Domain members need no metafield: removing the revocation restores auto-eligibility.
    await db.employeeMembership.update({
      where: { id: m.id },
      data: { status: "active", revokedAt: null, verifiedAt: now, expiresAt: null },
    });
    await clearEligibility(admin, customerId);
  } else {
    const expiresAt = computeExpiry(now, program.eligibilityMonths);
    await db.employeeMembership.update({
      where: { id: m.id },
      data: { status: "active", revokedAt: null, verifiedAt: now, expiresAt },
    });
    await publishEligibility(admin, customerId, buildEligibilityValue(expiresAt, m.businessId));
  }
  await audit({ shop, actor, action: "membership.reactivate", subject: customerId, result: "ok" });
  return true;
}

// --- Domain members (account email at an approved domain) ---------------------------

/**
 * Records/updates a domain member for the Employees list. Eligibility itself is decided live by the
 * Functions from the account email, so no metafield is written here.
 * Never overrides a revocation or an active link-verified membership.
 */
export async function recordDomainCustomer(shop: string, customerId: string, accountEmail: string | null) {
  const program = await getProgram(shop);
  const existing = await getMembership(shop, customerId);
  const eligible = isDomainEligible(program, accountEmail);
  const email = accountEmail ? normalizeEmail(accountEmail) : null;
  const business = eligible ? businessOf(program, accountEmail) : null;

  if (!existing) {
    if (!eligible || !email || !business) return "skipped" as const;
    await db.employeeMembership.create({
      data: { shop, customerId, workEmail: email, businessId: business.id, source: "domain", status: "active", verifiedAt: new Date(), expiresAt: null },
    });
    await audit({ shop, actor: "system", action: "membership.domain_join", subject: customerId, result: "ok", detail: maskEmail(email) });
    return "added" as const;
  }
  if (existing.source !== "domain" || existing.status === "revoked") return "unchanged" as const;
  const next = eligible ? "active" : "inactive";
  if (existing.status !== next || (email && existing.workEmail !== email) || (business && existing.businessId !== business.id)) {
    await db.employeeMembership.update({
      where: { id: existing.id },
      data: { status: next, ...(email ? { workEmail: email } : {}), ...(business ? { businessId: business.id } : {}) },
    });
    await audit({ shop, actor: "system", action: `membership.domain_${next}`, subject: customerId, result: "ok" });
    return "updated" as const;
  }
  return "unchanged" as const;
}

/** Scans existing customers (up to `maxPages` x 250) and records domain members. */
export async function syncDomainCustomers(admin: AdminClient, shop: string, maxPages = 20) {
  const program = await getProgram(shop);
  if (!program.autoDomain || !program.domains.length) return { scanned: 0, added: 0, truncated: false };
  let after: string | null = null;
  let scanned = 0;
  let added = 0;
  for (let page = 0; page < maxPages; page++) {
    type Page = {
      customers: {
        nodes: { id: string; defaultEmailAddress?: { emailAddress?: string } | null }[];
        pageInfo: { hasNextPage: boolean; endCursor: string | null };
      };
    };
    const data: Page = await gql<Page>(admin, `#graphql
      query PerksCustomers($after: String) {
        customers(first: 250, after: $after) {
          nodes { id defaultEmailAddress { emailAddress } }
          pageInfo { hasNextPage endCursor }
        }
      }`, { after });
    for (const c of data.customers.nodes) {
      scanned++;
      const email = c.defaultEmailAddress?.emailAddress ?? null;
      if (!isDomainEligible(program, email)) continue;
      const id = c.id.split("/").pop()!;
      if ((await recordDomainCustomer(shop, id, email)) === "added") added++;
    }
    if (!data.customers.pageInfo.hasNextPage) return { scanned, added, truncated: false };
    after = data.customers.pageInfo.endCursor;
  }
  return { scanned, added, truncated: true };
}

/** Clears eligibility for active memberships past their expiry. Idempotent. */
export async function sweepExpired(admin: AdminClient, shop: string, now = new Date()) {
  const due = await db.employeeMembership.findMany({
    where: { shop, source: "link", status: "active", expiresAt: { lte: now } },
    take: 200,
  });
  let expired = 0;
  for (const m of due) {
    if (!isExpired(m.expiresAt, now)) continue;
    try {
      await clearEligibility(admin, m.customerId);
      await db.employeeMembership.update({ where: { id: m.id }, data: { status: "expired" } });
      await audit({ shop, actor: "system", action: "membership.expire", subject: m.customerId, result: "ok" });
      expired++;
    } catch (err) {
      console.error("[perks] expire failed", m.customerId, err);
      await audit({ shop, actor: "system", action: "membership.expire", subject: m.customerId, result: "error" });
    }
  }
  await db.verificationChallenge.deleteMany({
    where: { shop, expiresAt: { lt: new Date(now.getTime() - 7 * 24 * 3600_000) } },
  });
  return { checked: due.length, expired };
}

// --- Privacy -----------------------------------------------------------------

export async function exportCustomerData(shop: string, customerId: string) {
  const [membership, challenges] = await Promise.all([
    db.employeeMembership.findUnique({ where: { shop_customerId: { shop, customerId } } }),
    db.verificationChallenge.findMany({
      where: { shop, customerId },
      select: { workEmail: true, createdAt: true, expiresAt: true, consumedAt: true },
    }),
  ]);
  return { membership, verificationRequests: challenges };
}

export async function redactCustomer(shop: string, customerId: string, admin?: AdminClient) {
  if (admin) {
    try {
      await clearEligibility(admin, customerId);
    } catch (err) {
      console.warn("[perks] redact: could not clear metafield", err);
    }
  }
  await db.$transaction([
    db.employeeMembership.deleteMany({ where: { shop, customerId } }),
    db.verificationChallenge.deleteMany({ where: { shop, customerId } }),
    db.rateLimitHit.deleteMany({ where: { shop, key: { contains: `customer:${customerId}` } } }),
    // Keep billing totals, drop the link to the person.
    db.orderUsage.updateMany({ where: { shop, customerId }, data: { customerId: "redacted" } }),
  ]);
  await audit({ shop, actor: "system", action: "privacy.customer_redact", subject: customerId, result: "ok" });
}

export async function redactShop(shop: string) {
  await db.$transaction([
    db.employeeMembership.deleteMany({ where: { shop } }),
    db.verificationChallenge.deleteMany({ where: { shop } }),
    db.rateLimitHit.deleteMany({ where: { shop } }),
    db.auditEvent.deleteMany({ where: { shop } }),
    db.benefitPolicy.deleteMany({ where: { shop } }),
    db.employer.deleteMany({ where: { shop } }),
    db.business.deleteMany({ where: { shop } }),
    db.orderUsage.deleteMany({ where: { shop } }),
    db.invoice.deleteMany({ where: { shop } }),
    db.session.deleteMany({ where: { shop } }),
  ]);
}
