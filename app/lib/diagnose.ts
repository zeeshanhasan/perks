/**
 * Perk debugger: explains, step by step, why a customer does or doesn't get employee perks.
 * Pure function so it's easy to test; the server wrapper gathers the inputs.
 */
import { emailDomain, isPublicEmailDomain } from "./domain";

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

/** link: a page in the app (or Settings) where the fix is made. */
export type Check = { status: "ok" | "fail" | "info"; title: string; detail?: string; link?: { label: string; href: string } };

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

  const domain = emailDomain(i.email);
  const byDomain = i.businesses.find((b) => b.domains.includes(domain)) ?? null;
  /** When an earlier step fails, still say what the email itself would match (or why it never could). */
  const domainNote = (): Check =>
    byDomain
      ? {
          status: "info",
          title: `${domain} matches ${byDomain.name}${byDomain.active ? "" : " (paused)"}`,
          detail: "Once the step above is fixed, they get this business's perks.",
        }
      : isPublicEmailDomain(domain)
        ? {
            status: "fail",
            title: `Personal emails (${domain}) never get perks`,
            detail: "Only work emails on a business's domain qualify. Ask them to use their work email.",
          }
        : {
            status: "fail",
            title: `${domain} isn't on any business`,
            detail: "Add this domain to a business if their company is a partner.",
            link: { label: "Open Businesses", href: "/app/businesses" },
          };

  if (!i.programOn) {
    checks.push({
      status: "fail",
      title: "Employee perks are off",
      detail: "Turn them on in Settings, and make sure at least one business is active.",
      link: { label: "Open Settings", href: "/app/settings" },
    });
    checks.push(domainNote());
    return done(false, byDomain?.name ?? null);
  }
  checks.push({ status: "ok", title: "Employee perks are on" });

  if (!i.customer) {
    checks.push({
      status: "fail",
      title: "No customer account with this email",
      detail: "They need to create an account (or log in once) with this email. Guest checkouts never get perks.",
    });
    checks.push(domainNote());
    return done(false, byDomain?.name ?? null);
  }
  checks.push({ status: "ok", title: "Customer account found" });

  const m = i.membership;
  if (m?.status === "revoked") {
    checks.push({
      status: "fail",
      title: "You removed this customer's perks",
      detail: "Restore them on the Employees page.",
      link: { label: "Open Employees", href: `/app/employees?status=revoked&q=${encodeURIComponent(i.email)}` },
    });
    return done(false);
  }

  const linkActive =
    m?.source === "link" && m.status === "active" && (!m.expiresAt || m.expiresAt.getTime() > i.now.getTime());
  const byLink = linkActive ? (i.businesses.find((b) => b.id === m?.businessId) ?? null) : null;

  let business: DiagnoseBusiness | null = null;
  if (byLink) {
    business = byLink;
    checks.push({ status: "ok", title: `Verified as an employee of ${byLink.name}`, detail: `They verified by email link before it was retired. Perks last${m?.expiresAt ? ` until ${m.expiresAt.toISOString().slice(0, 10)}` : ""}.` });
  } else if (byDomain && i.autoDomain) {
    business = byDomain;
    checks.push({ status: "ok", title: `Matched to ${byDomain.name}`, detail: `Their account email is at ${domain}.` });
  } else if (byDomain && !i.autoDomain) {
    checks.push({
      status: "fail",
      title: `${domain} belongs to ${byDomain.name}, but the app hasn't updated Shopify yet`,
      detail: "Open Settings and click Save once.",
      link: { label: "Open Settings", href: "/app/settings" },
    });
    return done(false);
  } else {
    const expired = m?.source === "link" && !linkActive;
    const personal = isPublicEmailDomain(domain);
    const on = (d: Date) => d.toISOString().slice(0, 10);
    checks.push({
      status: "fail",
      title: expired
        ? `Their email-link verification expired${m?.expiresAt ? ` on ${on(m.expiresAt)}` : ""}`
        : personal
          ? `This account uses a personal email (${domain})`
          : `${domain} isn't on any business`,
      detail: expired
        ? "Email-link verification has been retired. They can log in with their work email instead."
        : personal
          ? "Perks need a store account with a work email. Ask them to log out and log in, or create an account, with their work email."
          : "Add this domain to a business if their company is a partner.",
      link: expired || personal ? undefined : { label: "Open Businesses", href: "/app/businesses" },
    });
    return done(false);
  }

  if (!business.active) {
    checks.push({
      status: "fail",
      title: `${business.name} is paused`,
      detail: "Set it back to Active on the business page.",
      link: { label: `Open ${business.name}`, href: `/app/businesses/${business.id}` },
    });
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
