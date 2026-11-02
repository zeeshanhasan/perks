import db from "../db.server";

export type Limit = { key: string; max: number; windowMs: number };

export const LIMITS = {
  perCustomer: (customerId: string): Limit => ({ key: `verify:customer:${customerId}`, max: 5, windowMs: 3600_000 }),
  perEmail: (emailHash: string): Limit => ({ key: `verify:email:${emailHash}`, max: 3, windowMs: 3600_000 }),
  perShop: (): Limit => ({ key: "verify:shop", max: 200, windowMs: 3600_000 }),
};

/**
 * Sliding window. Returns false (blocked) if any limit is exceeded; otherwise records a hit on each.
 */
export async function consumeRateLimits(shop: string, limits: Limit[], now = new Date()): Promise<boolean> {
  for (const l of limits) {
    const count = await db.rateLimitHit.count({
      where: { shop, key: l.key, createdAt: { gt: new Date(now.getTime() - l.windowMs) } },
    });
    if (count >= l.max) return false;
  }
  await db.rateLimitHit.createMany({ data: limits.map((l) => ({ shop, key: l.key, createdAt: now })) });
  return true;
}

export async function pruneRateLimits(olderThanMs = 24 * 3600_000) {
  await db.rateLimitHit.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - olderThanMs) } } });
}
