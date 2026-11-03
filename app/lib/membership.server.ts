import db from "../db.server";
import type { AdminClient } from "./admin-graphql.server";
import { gql } from "./admin-graphql.server";
import { audit } from "./audit.server";
import { isApprovedEmail, maskEmail, normalizeEmail } from "./domain";
import { REVOKED_VALUE, buildEligibilityValue, computeExpiry, isExpired } from "./eligibility";
import { sendVerificationEmail } from "./email.server";
import { clearEligibility, publishEligibility } from "./metafields.server";
import { parseJsonList } from "./policy";
import { LIMITS, consumeRateLimits } from "./rate-limit.server";
import { TOKEN_TTL_MS, checkChallenge, generateToken, hashToken, isWellFormedToken } from "./tokens";

const customerActor = (id: string) => `customer:${id}`;

export async function getProgram(shop: string) {
  const [employer, policy] = await Promise.all([
    db.employer.findUnique({ where: { shop } }),
    db.benefitPolicy.findUnique({ where: { shop } }),
  ]);
  return {
    enabled: Boolean(policy?.enabled && employer),
    employerName: employer?.name ?? "",
    domains: parseJsonList(employer?.domains),
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

/** True when the customer is eligible automatically via their account email domain. */
export function isDomainEligible(program: { autoDomain: boolean; domains: string[] }, accountEmail: string | null) {
  return Boolean(program.autoDomain && accountEmail && isApprovedEmail(accountEmail, program.domains));
}

export async function getMembership(shop: string, customerId: string) {
  return db.employeeMembership.findUnique({ where: { shop_customerId: { shop, customerId } } });
}

/** Another customer already holds an active membership with this work email. */
async function emailInUseByOther(shop: string, workEmail: string, customerId: string) {
  const other = await db.employeeMembership.findFirst({
    where: { shop, workEmail, status: "active", NOT: { customerId } },
  });
  return Boolean(other);
}

export type RequestResult =
  | { ok: true }
  | { ok: false; reason: "disabled" | "revoked" | "invalid_email" | "domain_not_allowed" | "rate_limited" | "email_in_use" | "send_failed" };

export async function requestVerification(args: {
  shop: string;
  customerId: string;
  rawEmail: string;
  storefrontOrigin: string;
  shopName: string;
}): Promise<RequestResult> {
  const { shop, customerId } = args;
  const actor = customerActor(customerId);
  const program = await getProgram(shop);
  if (!program.enabled) return { ok: false, reason: "disabled" };
  // A merchant revocation sticks: the customer can't verify their way back in.
  if ((await getMembership(shop, customerId))?.status === "revoked") return { ok: false, reason: "revoked" };

  const email = normalizeEmail(args.rawEmail);
  const emailKey = hashToken(email ?? args.rawEmail.trim().toLowerCase());
  const allowed = await consumeRateLimits(shop, [
    LIMITS.perCustomer(customerId),
    LIMITS.perEmail(emailKey),
    LIMITS.perShop(),
  ]);
  if (!allowed) {
    await audit({ shop, actor, action: "verify.request", result: "rejected", detail: "rate_limited" });
    return { ok: false, reason: "rate_limited" };
  }
  if (!email) return { ok: false, reason: "invalid_email" };
  if (!isApprovedEmail(email, program.domains)) {
    await audit({ shop, actor, action: "verify.request", result: "rejected", detail: `domain_not_allowed ${maskEmail(email)}` });
    return { ok: false, reason: "domain_not_allowed" };
  }
  if (await emailInUseByOther(shop, email, customerId)) {
    await audit({ shop, actor, action: "verify.request", result: "rejected", detail: `email_in_use ${maskEmail(email)}` });
    return { ok: false, reason: "email_in_use" };
  }

  const token = generateToken();
  await db.verificationChallenge.create({
    data: {
      shop,
      customerId,
      workEmail: email,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + TOKEN_TTL_MS),
    },
  });
  const link = `${args.storefrontOrigin}/apps/perks/confirm?token=${encodeURIComponent(token)}`;
  try {
    await sendVerificationEmail({ to: email, employerName: program.employerName, shopName: args.shopName, link });
  } catch (err) {
    console.error("[perks] email send failed", err);
    await audit({ shop, actor, action: "verify.request", result: "error", detail: `send_failed ${maskEmail(email)}` });
    return { ok: false, reason: "send_failed" };
  }
  await audit({ shop, actor, action: "verify.request", result: "ok", detail: maskEmail(email) });
  return { ok: true };
}

export type ConfirmResult =
  | { ok: true; expiresAt: Date | null }
  | { ok: false; reason: "invalid" | "not_found" | "used" | "expired" | "wrong_customer" | "disabled" | "revoked" | "domain_not_allowed" | "email_in_use" | "publish_failed" };

export async function confirmVerification(args: {
  admin: AdminClient;
  shop: string;
  customerId: string;
  token: unknown;
  now?: Date;
}): Promise<ConfirmResult> {
  const { admin, shop, customerId } = args;
  const now = args.now ?? new Date();
  const actor = customerActor(customerId);
  if (!isWellFormedToken(args.token)) return { ok: false, reason: "invalid" };

  const challenge = await db.verificationChallenge.findFirst({
    where: { shop, tokenHash: hashToken(args.token) },
  });
  const state = checkChallenge(challenge, customerId, now);
  if (!state.ok) {
    await audit({ shop, actor, action: "verify.confirm", result: "rejected", detail: state.reason });
    return { ok: false, reason: state.reason };
  }

  // Single use, race-safe: only one request can flip consumedAt from null.
  const claimed = await db.verificationChallenge.updateMany({
    where: { id: challenge!.id, consumedAt: null },
    data: { consumedAt: now },
  });
  if (claimed.count !== 1) return { ok: false, reason: "used" };

  const program = await getProgram(shop);
  if (!program.enabled) return { ok: false, reason: "disabled" };
  if ((await getMembership(shop, customerId))?.status === "revoked") return { ok: false, reason: "revoked" };
  const email = challenge!.workEmail;
  if (!isApprovedEmail(email, program.domains)) {
    await audit({ shop, actor, action: "verify.confirm", result: "rejected", detail: "domain_not_allowed" });
    return { ok: false, reason: "domain_not_allowed" };
  }
  if (await emailInUseByOther(shop, email, customerId)) {
    await audit({ shop, actor, action: "verify.confirm", result: "rejected", detail: "email_in_use" });
    return { ok: false, reason: "email_in_use" };
  }

  const expiresAt = computeExpiry(now, program.eligibilityMonths);
  await db.employeeMembership.upsert({
    where: { shop_customerId: { shop, customerId } },
    create: { shop, customerId, workEmail: email, source: "link", status: "active", verifiedAt: now, expiresAt },
    update: { workEmail: email, source: "link", status: "active", verifiedAt: now, expiresAt, revokedAt: null },
  });
  try {
    await publishEligibility(admin, customerId, buildEligibilityValue(expiresAt));
  } catch (err) {
    console.error("[perks] publish eligibility failed", err);
    await audit({ shop, actor, action: "verify.confirm", subject: customerId, result: "error", detail: "publish_failed" });
    return { ok: false, reason: "publish_failed" };
  }
  await audit({ shop, actor, action: "verify.confirm", subject: customerId, result: "ok", detail: maskEmail(email) });
  return { ok: true, expiresAt };
}

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
    await publishEligibility(admin, customerId, buildEligibilityValue(expiresAt));
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

  if (!existing) {
    if (!eligible || !email) return "skipped" as const;
    await db.employeeMembership.create({
      data: { shop, customerId, workEmail: email, source: "domain", status: "active", verifiedAt: new Date(), expiresAt: null },
    });
    await audit({ shop, actor: "system", action: "membership.domain_join", subject: customerId, result: "ok", detail: maskEmail(email) });
    return "added" as const;
  }
  if (existing.source !== "domain" || existing.status === "revoked") return "unchanged" as const;
  const next = eligible ? "active" : "inactive";
  if (existing.status !== next || (email && existing.workEmail !== email)) {
    await db.employeeMembership.update({
      where: { id: existing.id },
      data: { status: next, ...(email ? { workEmail: email } : {}) },
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
    db.session.deleteMany({ where: { shop } }),
  ]);
}
