import { describe, expect, it } from "vitest";
import type { DiagnoseInput } from "../app/lib/diagnose";
import { diagnose } from "../app/lib/diagnose";

const acme = { id: "b1", name: "Acme", domains: ["acme.com"], active: true, limitPeriod: "none", limitBasis: "discount", limitAmount: null };
const base: DiagnoseInput = {
  email: "sara@acme.com",
  programOn: true,
  autoDomain: true,
  businesses: [acme],
  customer: { id: "1" },
  membership: null,
  usage: {},
  now: new Date("2026-11-04T00:00:00Z"),
  formatMoney: (n) => `Rs ${n}`,
};
const last = (d: ReturnType<typeof diagnose>) => d.checks.filter((c) => c.status !== "info").at(-1)!;

describe("diagnose", () => {
  it("eligible by work email domain", () => {
    const d = diagnose(base);
    expect(d.eligible).toBe(true);
    expect(d.businessName).toBe("Acme");
  });

  it("program off", () => {
    const d = diagnose({ ...base, programOn: false });
    expect(d.eligible).toBe(false);
    expect(last(d).title).toMatch(/off/);
  });

  it("no customer account", () => {
    const d = diagnose({ ...base, customer: null });
    expect(d.eligible).toBe(false);
    expect(last(d).title).toMatch(/No customer account/);
  });

  it("revoked beats a matching domain", () => {
    const d = diagnose({ ...base, membership: { status: "revoked", source: "domain", businessId: "b1", expiresAt: null } });
    expect(d.eligible).toBe(false);
    expect(last(d).title).toMatch(/removed/);
  });

  it("unknown domain", () => {
    const d = diagnose({ ...base, email: "sara@gmail.com" });
    expect(d.eligible).toBe(false);
    expect(last(d).title).toMatch(/gmail.com isn't on any business/);
  });

  it("verified by link with a personal email", () => {
    const d = diagnose({
      ...base,
      email: "sara@gmail.com",
      membership: { status: "active", source: "link", businessId: "b1", expiresAt: new Date("2027-01-01") },
    });
    expect(d.eligible).toBe(true);
    expect(d.checks.some((c) => /Verified as an employee of Acme/.test(c.title))).toBe(true);
  });

  it("expired link verification", () => {
    const d = diagnose({
      ...base,
      email: "sara@gmail.com",
      membership: { status: "active", source: "link", businessId: "b1", expiresAt: new Date("2026-01-01") },
    });
    expect(d.eligible).toBe(false);
    expect(last(d).title).toMatch(/expired/);
  });

  it("auto domain off", () => {
    const d = diagnose({ ...base, autoDomain: false });
    expect(d.eligible).toBe(false);
    expect(last(d).title).toMatch(/automatic perks by email are off/);
  });

  it("paused business", () => {
    const d = diagnose({ ...base, businesses: [{ ...acme, active: false }] });
    expect(d.eligible).toBe(false);
    expect(last(d).title).toMatch(/paused/);
  });

  it("limit reached and within limit", () => {
    const limited = { ...acme, limitPeriod: "month", limitBasis: "discount", limitAmount: 1000 };
    const over = diagnose({ ...base, businesses: [limited], usage: { b1: { md: 1000, ms: 0, yd: 1000, ys: 0 } } });
    expect(over.eligible).toBe(false);
    expect(last(over).title).toMatch(/limit/);
    const under = diagnose({ ...base, businesses: [limited], usage: { b1: { md: 200, ms: 0, yd: 200, ys: 0 } } });
    expect(under.eligible).toBe(true);
    expect(under.checks.find((c) => c.title === "Within the limit")?.detail).toMatch(/Rs 200 of Rs 1000/);
  });
});
