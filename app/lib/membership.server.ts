import db from "../db.server";
import type { AdminClient } from "./admin-graphql.server";
import { audit } from "./audit.server";
import { isApprovedEmail, maskEmail, normalizeEmail } from "./domain";
import { buildEligibilityValue, computeExpiry, isExpired } from "./eligibility";
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
  };
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
  | { ok: false; reason: "disabled" | "invalid_email" | "domain_not_allowed" | "rate_limited" | "email_in_use" | "send_failed" };

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
  | { ok: false; reason: "invalid" | "not_found" | "used" | "expired" | "wrong_customer" | "disabled" | "domain_not_allowed" | "email_in_use" | "publish_failed" };

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
    create: { shop, customerId, workEmail: email, status: "active", verifiedAt: now, expiresAt },
    update: { workEmail: email, status: "active", verifiedAt: now, expiresAt, revokedAt: null },
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
  await clearEligibility(admin, customerId);
  await audit({ shop, actor, action: "membership.revoke", subject: customerId, result: "ok" });
  return true;
}

export async function reactivateMembership(admin: AdminClient, shop: string, customerId: string, actor: string) {
  const m = await getMembership(shop, customerId);
  if (!m) return false;
  const program = await getProgram(shop);
  const now = new Date();
  const expiresAt = computeExpiry(now, program.eligibilityMonths);
  await db.employeeMembership.update({
    where: { id: m.id },
    data: { status: "active", revokedAt: null, verifiedAt: now, expiresAt },
  });
  await publishEligibility(admin, customerId, buildEligibilityValue(expiresAt));
  await audit({ shop, actor, action: "membership.reactivate", subject: customerId, result: "ok" });
  return true;
}

/** Clears eligibility for active memberships past their expiry. Idempotent. */
export async function sweepExpired(admin: AdminClient, shop: string, now = new Date()) {
  const due = await db.employeeMembership.findMany({
    where: { shop, status: "active", expiresAt: { lte: now } },
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
