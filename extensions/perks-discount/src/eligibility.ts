/**
 * Fail-closed buyer eligibility. Shared logic, copied into each Function so they bundle
 * independently (a test asserts the copies are identical). Keep in sync with app/lib/eligibility.ts.
 *
 * Eligible when the buyer is a logged-in customer AND not revoked AND either:
 *  - has an active, unexpired eligibility metafield (verified via emailed link), or
 *  - auto-domain is on and the customer's ACCOUNT email is at an approved domain
 *    (new customer accounts prove email ownership with a login code).
 * The checkout contact email is never used: guests can type anything.
 */
type Meta = { value: string } | null | undefined;

export type Buyer =
  | {
      isAuthenticated?: boolean | null;
      customer?: { email?: string | null; eligibility?: Meta } | null;
    }
  | null
  | undefined;

export type EligibilityConfig = { domains: string[]; autoDomain: boolean };

type Parsed = { status: "active"; expiresAt: string | null } | { status: "revoked" } | null;

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export function parseEligibility(raw: string | null | undefined): Parsed {
  if (!raw) return null;
  let v: unknown;
  try {
    v = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  if (o.v !== 1) return null;
  if (o.status === "revoked") return { status: "revoked" };
  if (o.status !== "active") return null;
  if (o.expiresAt === null) return { status: "active", expiresAt: null };
  if (typeof o.expiresAt === "string" && DATE.test(o.expiresAt)) return { status: "active", expiresAt: o.expiresAt };
  return null;
}

export function emailDomain(email: string | null | undefined): string | null {
  if (typeof email !== "string") return null;
  const e = email.trim().toLowerCase();
  const at = e.lastIndexOf("@");
  if (at <= 0 || at !== e.indexOf("@")) return null;
  return e.slice(at + 1) || null;
}

export function isEligibleBuyer(buyer: Buyer, config: EligibilityConfig, today: string): boolean {
  const customer = buyer?.customer;
  if (!customer || buyer?.isAuthenticated === false) return false;
  const parsed = parseEligibility(customer.eligibility?.value);
  if (parsed?.status === "revoked") return false;
  if (parsed?.status === "active") {
    if (parsed.expiresAt === null) return true;
    if (typeof today === "string" && today.slice(0, 10) < parsed.expiresAt) return true;
  }
  if (config.autoDomain) {
    const domain = emailDomain(customer.email);
    if (domain && config.domains.includes(domain)) return true;
  }
  return false;
}

export function parseEligibilityConfig(raw: unknown): EligibilityConfig {
  const c = (raw ?? {}) as Record<string, unknown>;
  const domains = Array.isArray(c.domains)
    ? c.domains.filter((d): d is string => typeof d === "string").map((d) => d.toLowerCase())
    : [];
  return { domains, autoDomain: c.autoDomain === true };
}
