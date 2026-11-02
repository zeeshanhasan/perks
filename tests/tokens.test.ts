import { expect, test } from "vitest";
import { checkChallenge, generateToken, hashToken, isWellFormedToken } from "../app/lib/tokens";

test("tokens are random, well-formed and hashed deterministically", () => {
  const a = generateToken();
  const b = generateToken();
  expect(a).not.toBe(b);
  expect(isWellFormedToken(a)).toBe(true);
  expect(hashToken(a)).toBe(hashToken(a));
  expect(hashToken(a)).not.toContain(a);
  expect(isWellFormedToken("short")).toBe(false);
  expect(isWellFormedToken("../../etc/passwd")).toBe(false);
});

test("checkChallenge enforces customer binding, single use and expiry", () => {
  const now = new Date("2026-11-02T12:00:00Z");
  const base = { customerId: "1", expiresAt: new Date("2026-11-02T12:30:00Z"), consumedAt: null };
  expect(checkChallenge(base, "1", now)).toEqual({ ok: true });
  expect(checkChallenge(null, "1", now)).toEqual({ ok: false, reason: "not_found" });
  expect(checkChallenge(base, "2", now)).toEqual({ ok: false, reason: "wrong_customer" });
  expect(checkChallenge({ ...base, consumedAt: now }, "1", now)).toEqual({ ok: false, reason: "used" });
  expect(checkChallenge(base, "1", new Date("2026-11-02T12:30:00Z"))).toEqual({ ok: false, reason: "expired" });
});
