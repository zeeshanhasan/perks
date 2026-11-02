/**
 * Work-email domain rules. Exact match only: no subdomains, no look-alikes.
 */

const DOMAIN_RE = /^(?=.{1,253}$)(?!-)[a-z0-9-]{1,63}(?<!-)(\.(?!-)[a-z0-9-]{1,63}(?<!-))+$/;
const LOCAL_RE = /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]{1,64}$/;

export function normalizeDomain(raw: string): string | null {
  const d = raw.trim().toLowerCase().replace(/^@/, "").replace(/\.$/, "");
  return DOMAIN_RE.test(d) ? d : null;
}

/** Parses free text ("a.com, b.com\nc.com") into a unique, valid domain list. */
export function parseDomainList(raw: string): { domains: string[]; invalid: string[] } {
  const parts = raw
    .split(/[\s,;]+/)
    .map((p) => p.trim())
    .filter(Boolean);
  const domains: string[] = [];
  const invalid: string[] = [];
  for (const p of parts) {
    const d = normalizeDomain(p);
    if (!d) invalid.push(p);
    else if (!domains.includes(d)) domains.push(d);
  }
  return { domains, invalid };
}

export function normalizeEmail(raw: string): string | null {
  const e = raw.trim().toLowerCase();
  const at = e.lastIndexOf("@");
  if (at <= 0 || at !== e.indexOf("@")) return null;
  const local = e.slice(0, at);
  const domain = normalizeDomain(e.slice(at + 1));
  if (!domain || !LOCAL_RE.test(local)) return null;
  if (local.startsWith(".") || local.endsWith(".") || local.includes("..")) return null;
  return `${local}@${domain}`;
}

export function emailDomain(email: string): string {
  return email.slice(email.lastIndexOf("@") + 1);
}

/** True only when the normalized email's domain exactly equals an approved domain. */
export function isApprovedEmail(rawEmail: string, approvedDomains: string[]): boolean {
  const email = normalizeEmail(rawEmail);
  if (!email) return false;
  const domain = emailDomain(email);
  return approvedDomains.some((d) => normalizeDomain(d) === domain);
}

/** For audit logs: never log the full work email. */
export function maskEmail(email: string): string {
  const at = email.lastIndexOf("@");
  if (at <= 0) return "***";
  return `${email[0]}***@${email.slice(at + 1)}`;
}
