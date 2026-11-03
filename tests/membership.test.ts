/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, test, vi } from "vitest";
import db from "../app/db.server";
import {
  confirmVerification,
  reactivateMembership,
  recordDomainCustomer,
  redactCustomer,
  requestVerification,
  revokeMembership,
  sweepExpired,
} from "../app/lib/membership.server";

const SHOP = "perks-test.myshopify.com";
const EMP = "1001";
const NORMAL = "1002";

// Fake Admin API: records metafield writes per customer.
function fakeAdmin() {
  const metafields = new Map<string, string>();
  const admin = {
    graphql: vi.fn(async (query: string, opts?: { variables?: any }) => {
      const v = opts?.variables ?? {};
      if (query.includes("metafieldsSet")) {
        for (const m of v.metafields) metafields.set(m.ownerId, m.value);
        return Response.json({ data: { metafieldsSet: { metafields: [], userErrors: [] } } });
      }
      if (query.includes("metafieldsDelete")) {
        for (const m of v.metafields) metafields.delete(m.ownerId);
        return Response.json({ data: { metafieldsDelete: { deletedMetafields: [], userErrors: [] } } });
      }
      throw new Error("unexpected query");
    }),
  };
  return { admin, metafields };
}

let sentLinks: string[] = [];
vi.mock("../app/lib/email.server", () => ({
  sendVerificationEmail: async (m: { link: string }) => {
    sentLinks.push(m.link);
  },
}));

const tokenFromLastLink = () => new URL(sentLinks.at(-1)!).searchParams.get("token")!;
const request = (customerId: string, rawEmail = "zeeshan@tofoapp.com") =>
  requestVerification({ shop: SHOP, customerId, rawEmail, storefrontOrigin: `https://${SHOP}`, shopName: "Perks" });

beforeEach(async () => {
  sentLinks = [];
  await db.auditEvent.deleteMany();
  await db.rateLimitHit.deleteMany();
  await db.verificationChallenge.deleteMany();
  await db.employeeMembership.deleteMany();
  await db.employer.upsert({
    where: { shop: SHOP },
    create: { shop: SHOP, name: "Tofo", domains: '["tofoapp.com"]' },
    update: { name: "Tofo", domains: '["tofoapp.com"]' },
  });
  await db.benefitPolicy.upsert({
    where: { shop: SHOP },
    create: { shop: SHOP, enabled: true, eligibilityMonths: 12, autoDomain: true },
    update: { enabled: true, eligibilityMonths: 12, autoDomain: true },
  });
});

describe("verification flow", () => {
  test("A2+A4: request then confirm grants eligibility and publishes the metafield", async () => {
    const { admin, metafields } = fakeAdmin();
    expect(await request(EMP)).toEqual({ ok: true });
    expect(sentLinks[0]).toMatch(/^https:\/\/perks-test\.myshopify\.com\/apps\/perks\/confirm\?token=/);

    const res = await confirmVerification({ admin, shop: SHOP, customerId: EMP, token: tokenFromLastLink() });
    expect(res.ok).toBe(true);
    const value = JSON.parse(metafields.get(`gid://shopify/Customer/${EMP}`)!);
    expect(value).toMatchObject({ v: 1, status: "active" });
    expect(value.expiresAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    const m = await db.employeeMembership.findFirstOrThrow({ where: { shop: SHOP, customerId: EMP } });
    expect(m.status).toBe("active");
  });

  test("raw token and full email never land in the DB audit log", async () => {
    const { admin } = fakeAdmin();
    await request(EMP);
    const token = tokenFromLastLink();
    await confirmVerification({ admin, shop: SHOP, customerId: EMP, token });
    const challenges = await db.verificationChallenge.findMany();
    expect(JSON.stringify(challenges)).not.toContain(token);
    const audit = JSON.stringify(await db.auditEvent.findMany());
    expect(audit).not.toContain(token);
    expect(audit).not.toContain("zeeshan@tofoapp.com");
  });

  test("A3: look-alike domain rejected, no email sent", async () => {
    expect(await request(EMP, "zeeshan@tofoapp.com.evil.io")).toEqual({ ok: false, reason: "domain_not_allowed" });
    expect(sentLinks).toHaveLength(0);
  });

  test("A5: link works once", async () => {
    const { admin } = fakeAdmin();
    await request(EMP);
    const token = tokenFromLastLink();
    expect((await confirmVerification({ admin, shop: SHOP, customerId: EMP, token })).ok).toBe(true);
    expect(await confirmVerification({ admin, shop: SHOP, customerId: EMP, token })).toEqual({ ok: false, reason: "used" });
  });

  test("A6: expired link rejected", async () => {
    const { admin } = fakeAdmin();
    await request(EMP);
    const later = new Date(Date.now() + 31 * 60 * 1000);
    expect(await confirmVerification({ admin, shop: SHOP, customerId: EMP, token: tokenFromLastLink(), now: later })).toEqual({
      ok: false,
      reason: "expired",
    });
  });

  test("A7: another customer cannot use the link", async () => {
    const { admin, metafields } = fakeAdmin();
    await request(EMP);
    expect(await confirmVerification({ admin, shop: SHOP, customerId: NORMAL, token: tokenFromLastLink() })).toEqual({
      ok: false,
      reason: "wrong_customer",
    });
    expect(metafields.size).toBe(0);
  });

  test("A8: rate limited after 5 requests per hour", async () => {
    for (let i = 0; i < 5; i++) await request(EMP, `user${i}@tofoapp.com`);
    expect(await request(EMP, "user9@tofoapp.com")).toEqual({ ok: false, reason: "rate_limited" });
  });

  test("one work email cannot be shared across customer accounts", async () => {
    const { admin } = fakeAdmin();
    await request(EMP);
    await confirmVerification({ admin, shop: SHOP, customerId: EMP, token: tokenFromLastLink() });
    expect(await request(NORMAL)).toEqual({ ok: false, reason: "email_in_use" });
  });

  test("program disabled: no verification", async () => {
    await db.benefitPolicy.update({ where: { shop: SHOP }, data: { enabled: false } });
    expect(await request(EMP)).toEqual({ ok: false, reason: "disabled" });
  });

  test("E5: shops are isolated", async () => {
    const { admin } = fakeAdmin();
    await request(EMP);
    const res = await confirmVerification({ admin, shop: "other.myshopify.com", customerId: EMP, token: tokenFromLastLink() });
    expect(res.ok).toBe(false);
  });
});

describe("lifecycle", () => {
  async function verified() {
    const fake = fakeAdmin();
    await request(EMP);
    await confirmVerification({ admin: fake.admin, shop: SHOP, customerId: EMP, token: tokenFromLastLink() });
    return fake;
  }

  test("D1: revoke writes an explicit revoked value (overrides domain eligibility)", async () => {
    const { admin, metafields } = await verified();
    await revokeMembership(admin, SHOP, EMP, "merchant:test");
    expect(JSON.parse(metafields.get(`gid://shopify/Customer/${EMP}`)!)).toEqual({ v: 1, status: "revoked" });
    expect((await db.employeeMembership.findFirstOrThrow({ where: { customerId: EMP } })).status).toBe("revoked");
  });

  test("D2: sweep expires memberships past expiry", async () => {
    const { admin, metafields } = await verified();
    await db.employeeMembership.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });
    expect(await sweepExpired(admin, SHOP)).toEqual({ checked: 1, expired: 1 });
    expect(metafields.size).toBe(0);
    expect(await sweepExpired(admin, SHOP)).toEqual({ checked: 0, expired: 0 });
  });

  test("D3: revoked employee cannot verify their way back; merchant can restore", async () => {
    const { admin, metafields } = await verified();
    await revokeMembership(admin, SHOP, EMP, "merchant:test");
    expect(await request(EMP)).toEqual({ ok: false, reason: "revoked" });
    await reactivateMembership(admin, SHOP, EMP, "merchant:test");
    expect(JSON.parse(metafields.get(`gid://shopify/Customer/${EMP}`)!)).toMatchObject({ v: 1, status: "active" });
  });

  test("E4: customers/redact deletes the customer's data", async () => {
    const { admin, metafields } = await verified();
    await redactCustomer(SHOP, EMP, admin);
    expect(await db.employeeMembership.count({ where: { customerId: EMP } })).toBe(0);
    expect(await db.verificationChallenge.count({ where: { customerId: EMP } })).toBe(0);
    expect(metafields.size).toBe(0);
  });
});

describe("domain members", () => {
  test("customer with approved account email is recorded; others skipped", async () => {
    expect(await recordDomainCustomer(SHOP, "2001", "Zeeshan@tofoapp.com")).toBe("added");
    expect(await recordDomainCustomer(SHOP, "2002", "someone@gmail.com")).toBe("skipped");
    const m = await db.employeeMembership.findFirstOrThrow({ where: { customerId: "2001" } });
    expect(m).toMatchObject({ source: "domain", status: "active", workEmail: "zeeshan@tofoapp.com", expiresAt: null });
  });

  test("changing email away from the domain marks inactive, and back again active", async () => {
    await recordDomainCustomer(SHOP, "2001", "zeeshan@tofoapp.com");
    expect(await recordDomainCustomer(SHOP, "2001", "zeeshan@gmail.com")).toBe("updated");
    expect((await db.employeeMembership.findFirstOrThrow({ where: { customerId: "2001" } })).status).toBe("inactive");
    await recordDomainCustomer(SHOP, "2001", "zeeshan@tofoapp.com");
    expect((await db.employeeMembership.findFirstOrThrow({ where: { customerId: "2001" } })).status).toBe("active");
  });

  test("webhooks never undo a revocation", async () => {
    const { admin, metafields } = fakeAdmin();
    await recordDomainCustomer(SHOP, "2001", "zeeshan@tofoapp.com");
    await revokeMembership(admin, SHOP, "2001", "merchant:test");
    expect(await recordDomainCustomer(SHOP, "2001", "zeeshan@tofoapp.com")).toBe("unchanged");
    expect((await db.employeeMembership.findFirstOrThrow({ where: { customerId: "2001" } })).status).toBe("revoked");
    // Restoring a domain member clears the revoked flag so domain eligibility applies again.
    await reactivateMembership(admin, SHOP, "2001", "merchant:test");
    expect(metafields.has("gid://shopify/Customer/2001")).toBe(false);
  });

  test("auto-domain off: nobody is added", async () => {
    await db.benefitPolicy.update({ where: { shop: SHOP }, data: { autoDomain: false } });
    expect(await recordDomainCustomer(SHOP, "2001", "zeeshan@tofoapp.com")).toBe("skipped");
  });

  test("expiry sweep ignores domain members", async () => {
    const { admin } = fakeAdmin();
    await recordDomainCustomer(SHOP, "2001", "zeeshan@tofoapp.com");
    await db.employeeMembership.updateMany({ where: { customerId: "2001" }, data: { expiresAt: new Date(Date.now() - 1000) } });
    expect(await sweepExpired(admin, SHOP)).toEqual({ checked: 0, expired: 0 });
  });
});
