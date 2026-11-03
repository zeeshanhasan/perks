import { createHash, randomBytes } from "node:crypto";

export const TOKEN_TTL_MS = 30 * 60 * 1000;

/** 32 random bytes, URL-safe. Only ever sent to the work inbox. */
export function generateToken(): string {
  return randomBytes(32).toString("base64url");
}

/** What we store. The raw token is never persisted. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function isWellFormedToken(token: unknown): token is string {
  return typeof token === "string" && /^[A-Za-z0-9_-]{43}$/.test(token);
}

export type ChallengeState =
  | { ok: true }
  | { ok: false; reason: "not_found" | "used" | "expired" | "wrong_customer" };

export function checkChallenge(
  challenge: { customerId: string; expiresAt: Date; consumedAt: Date | null } | null,
  customerId: string,
  now: Date,
): ChallengeState {
  if (!challenge) return { ok: false, reason: "not_found" };
  if (challenge.customerId !== customerId) return { ok: false, reason: "wrong_customer" };
  if (challenge.consumedAt) return { ok: false, reason: "used" };
  if (challenge.expiresAt.getTime() <= now.getTime()) return { ok: false, reason: "expired" };
  return { ok: true };
}
