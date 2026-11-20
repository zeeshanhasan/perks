/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, test, vi } from "vitest";
import db from "../app/db.server";
import {
  reactivateMembership,
  recordDomainCustomer,
  redactCustomer,
  redactShop,
  revokeMembership,
  sweepExpired,
} from "../app/lib/membership.server";

const SHOP = "perks-test.myshopify.com";
const EMP = "1001";

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

beforeEach(async () => {
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

describe("lifecycle (employees who verified by email link before decision 016)", () => {
  /** A link-verified employee as the old flow left them: membership row + active eligibility metafield. */
  async function verified() {
    const fake = fakeAdmin();
    const expiresAt = new Date(Date.now() + 30 * 86_400_000);
    await db.employeeMembership.create({
      data: { shop: SHOP, customerId: EMP, workEmail: "zeeshan@tofoapp.com", source: "link", status: "active", verifiedAt: new Date(), expiresAt },
    });
    fake.metafields.set(`gid://shopify/Customer/${EMP}`, JSON.stringify({ v: 1, status: "active", expiresAt: expiresAt.toISOString().slice(0, 10) }));
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

  test("D3: merchant can restore a removed employee", async () => {
    const { admin, metafields } = await verified();
    await revokeMembership(admin, SHOP, EMP, "merchant:test");
    await reactivateMembership(admin, SHOP, EMP, "merchant:test");
    expect(JSON.parse(metafields.get(`gid://shopify/Customer/${EMP}`)!)).toMatchObject({ v: 1, status: "active" });
  });

  test("E4: customers/redact deletes the customer's data", async () => {
    const { admin, metafields } = await verified();
    await db.auditEvent.create({ data: { shop: SHOP, actor: `customer:${EMP}`, action: "membership.domain_join", subject: EMP, result: "ok", detail: "z***@tofoapp.com" } });
    await redactCustomer(SHOP, EMP, admin);
    expect(await db.employeeMembership.count({ where: { customerId: EMP } })).toBe(0);
    expect(await db.verificationChallenge.count({ where: { customerId: EMP } })).toBe(0);
    expect(metafields.size).toBe(0);
    expect(await db.auditEvent.count({ where: { OR: [{ subject: EMP }, { actor: `customer:${EMP}` }] } })).toBe(0);
  });

  test("E4: customers/redact keeps order totals but drops the customer's ID and email", async () => {
    await db.orderUsage.deleteMany();
    await db.orderUsage.create({
      data: {
        shop: SHOP, orderId: "o1", orderName: "#1001", customerId: EMP, businessId: "b1",
        processedAt: new Date(), currency: "USD", spend: 90, total: 100, discount: 10, email: "a@tofoapp.com",
      },
    });
    await redactCustomer(SHOP, EMP);
    const o = await db.orderUsage.findFirstOrThrow({ where: { orderId: "o1" } });
    expect(o).toMatchObject({ customerId: "redacted", email: "", discount: 10 });
    await db.orderUsage.deleteMany();
  });

  test("E3: shop/redact deletes everything for the shop, including the store cache", async () => {
    await db.shopCache.create({ data: { shop: SHOP, shopGid: "gid://shopify/Shop/1", infoAt: new Date() } });
    await verified();
    await redactShop(SHOP);
    expect(await db.shopCache.count({ where: { shop: SHOP } })).toBe(0);
    expect(await db.employeeMembership.count({ where: { shop: SHOP } })).toBe(0);
    expect(await db.auditEvent.count({ where: { shop: SHOP } })).toBe(0);
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
