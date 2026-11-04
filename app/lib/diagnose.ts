/**
 * Perk debugger: explains, step by step, why a customer does or doesn't get employee perks.
 * Pure function so it's easy to test; the server wrapper gathers the inputs.
 */
import { emailDomain } from "./domain";

export type DiagnoseBusiness = {
  id: string;
  name: string;
  domains: string[];
  active: boolean;
  limitPeriod: string;
  limitBasis: string;
  limitAmount: number | null;
};

export type DiagnoseInput = {
  email: string;
  programOn: boolean;
  autoDomain: boolean;
  businesses: DiagnoseBusiness[];
  customer: { id: string } | null;
  membership: { status: string; source: string; businessId: string | null; expiresAt: Date | null } | null;
  /** This customer's usage per business: month/year discount and spend. */
  usage: Record<string, { md: number; ms: number; yd: number; ys: number }>;
  now: Date;
  formatMoney: (n: number) => string;
};

export type Check = { status: "ok" | "fail" | "info"; title: string; detail?: string };

export type Diagnosis = {
  eligible: boolean;
  businessName: string | null;
  customerId: string | null;
  checks: Check[];
};

export function diagnose(i: DiagnoseInput): Diagnosis {
  const checks: Check[] = [];
  const done = (eligible: boolean, businessName: string | null = null): Diagnosis => ({
    eligible,
    businessName,
    customerId: i.customer?.id ?? null,
    checks,
  });

  if (!i.programOn) {
    checks.push({ status: "fail", title: "Employee perks are off", detail: "Turn them on in Settings, and make sure at least one business is active." });
    return done(false);
  }
  checks.push({ status: "ok", title: "Employee perks are on" });

  if (!i.customer) {
    checks.push({
      status: "fail",
      title: "No customer account with this email",
      detail: "They need to create an account (or log in once) with this email. Guest checkouts never get perks.",
    });
    return done(false);
  }
  checks.push({ status: "ok", title: "Customer account found" });

  const m = i.membership;
  if (m?.status === "revoked") {
    checks.push({ status: "fail", title: "You removed this customer's perks", detail: "Restore them on the Employees page." });
    return done(false);
  }

  const domain = emailDomain(i.email);
  const byDomain = i.businesses.find((b) => b.domains.includes(domain)) ?? null;
  const linkActive =
    m?.source === "link" && m.status === "active" && (!m.expiresAt || m.expiresAt.getTime() > i.now.getTime());
  const byLink = linkActive ? (i.businesses.find((b) => b.id === m?.businessId) ?? null) : null;

  let business: DiagnoseBusiness | null = null;
  if (byLink) {
    business = byLink;
    checks.push({ status: "ok", title: `Verified as an employee of ${byLink.name}`, detail: "They confirmed their work email with the verification link." });
  } else if (byDomain && i.autoDomain) {
    business = byDomain;
    checks.push({ status: "ok", title: `Matched to ${byDomain.name}`, detail: `Their account email is at ${domain}.` });
  } else if (byDomain && !i.autoDomain) {
    checks.push({
      status: "fail",
      title: `${domain} belongs to ${byDomain.name}, but automatic perks by email are off`,
      detail: "Turn on automatic perks in Settings, or ask them to verify with the employee link.",
    });
    return done(false);
  } else {
    const expired = m?.source === "link" && !linkActive;
    checks.push({
      status: "fail",
      title: expired ? "Their employee verification expired" : `${domain} isn't on any business`,
      detail: expired
        ? "They can verify again with the employee link."
        : "Add this domain to a business, or the employee verifies a work email with the employee link.",
    });
    return done(false);
  }

  if (!business.active) {
    checks.push({ status: "fail", title: `${business.name} is paused`, detail: "Set it to active on the Businesses page." });
    return done(false, business.name);
  }

  if (business.limitPeriod !== "none" && business.limitAmount) {
    const u = i.usage[business.id] ?? { md: 0, ms: 0, yd: 0, ys: 0 };
    const used =
      business.limitPeriod === "month"
        ? business.limitBasis === "spend" ? u.ms : u.md
        : business.limitBasis === "spend" ? u.ys : u.yd;
    const what = business.limitBasis === "spend" ? "spend" : "discount";
    if (used >= business.limitAmount) {
      checks.push({
        status: "fail",
        title: `Reached this ${business.limitPeriod}'s limit`,
        detail: `${i.formatMoney(used)} of ${i.formatMoney(business.limitAmount)} ${what} used. Perks return next ${business.limitPeriod}.`,
      });
      return done(false, business.name);
    }
    checks.push({
      status: "ok",
      title: "Within the limit",
      detail: `${i.formatMoney(used)} of ${i.formatMoney(business.limitAmount)} ${what} used this ${business.limitPeriod}.`,
    });
  }

  checks.push({
    status: "info",
    title: "At checkout they must be logged in",
    detail: "And the products must be in this business's discounted or employee-only products.",
  });
  return done(true, business.name);
}
