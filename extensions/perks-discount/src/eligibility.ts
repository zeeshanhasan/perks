/**
 * Fail-closed eligibility check. Mirrors app/lib/eligibility.ts (value shape v1).
 * Kept as a copy in each Function so they bundle independently. Keep in sync.
 */
export function isEligible(raw: string | null | undefined, today: string): boolean {
  if (!raw) return false;
  let v: unknown;
  try {
    v = JSON.parse(raw);
  } catch {
    return false;
  }
  if (!v || typeof v !== "object") return false;
  const { v: version, status, expiresAt } = v as Record<string, unknown>;
  if (version !== 1 || status !== "active") return false;
  if (expiresAt === null) return true;
  if (typeof expiresAt !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(expiresAt)) return false;
  if (typeof today !== "string" || !/^\d{4}-\d{2}-\d{2}/.test(today)) return false;
  return today.slice(0, 10) < expiresAt;
}
