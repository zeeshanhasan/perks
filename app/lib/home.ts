/** Helpers for the Home page. Pure, so they're unit-tested. */

/** "1 active · 2 paused" style status lines, leaving out zero parts except the first. */
export function countLine(parts: [number, string][]): string {
  const shown = parts.filter(([n], i) => i === 0 || n > 0);
  return shown.map(([n, label]) => `${n} ${label}`).join(" · ");
}

export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

// --- Month picker -----------------------------------------------------------------------
// Months follow the shop's time zone (Shopify's ianaTimezone), so an order placed at 2 am on the 1st
// in Karachi counts in that month, not the one before. Unknown zones fall back to UTC.

export type MonthRange = { key: string; label: string; from: Date; to: Date };

const monthKey = (y: number, m: number) => `${y}-${String(m + 1).padStart(2, "0")}`;
const monthLabel = (y: number, m: number) =>
  new Date(Date.UTC(y, m, 1)).toLocaleString("en", { month: "long", year: "numeric", timeZone: "UTC" });

const formatters = new Map<string, Intl.DateTimeFormat>();
function formatter(tz: string) {
  let f = formatters.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
    });
    formatters.set(tz, f);
  }
  return f;
}

/** A valid IANA zone, or "UTC". */
export function safeTimeZone(tz: string | null | undefined): string {
  if (!tz) return "UTC";
  try {
    formatter(tz);
    return tz;
  } catch {
    return "UTC";
  }
}

/** Wall-clock parts of an instant in a zone. */
function zoned(d: Date, tz: string) {
  const p: Record<string, number> = {};
  for (const part of formatter(tz).formatToParts(d)) if (part.type !== "literal") p[part.type] = Number(part.value);
  return { y: p.year, m: p.month - 1, day: p.day, h: p.hour, min: p.minute, s: p.second };
}

/** Milliseconds the zone is ahead of UTC at that instant. */
function offset(d: Date, tz: string) {
  const z = zoned(d, tz);
  return Date.UTC(z.y, z.m, z.day, z.h, z.min, z.s) - Math.floor(d.getTime() / 1000) * 1000;
}

/** The instant the month starts (midnight on the 1st) in the zone. Month may overflow (12 = next January). */
export function zonedMonthStart(y: number, m: number, tz = "UTC"): Date {
  const wall = Date.UTC(y, m, 1);
  let t = wall - offset(new Date(wall), tz);
  t = wall - offset(new Date(t), tz); // second pass settles DST changes
  return new Date(t);
}

/** The month for "YYYY-MM" in the zone, or the current month when the key is missing, malformed or in the future. */
export function monthRange(key: string | null | undefined, now = new Date(), timeZone = "UTC"): MonthRange {
  const tz = safeTimeZone(timeZone);
  const today = zoned(now, tz);
  let y = today.y;
  let m = today.m;
  const match = /^(\d{4})-(\d{2})$/.exec(key ?? "");
  if (match) {
    const ky = Number(match[1]);
    const km = Number(match[2]) - 1;
    if (km >= 0 && km <= 11 && (ky < y || (ky === y && km <= m))) {
      y = ky;
      m = km;
    }
  }
  return { key: monthKey(y, m), label: monthLabel(y, m), from: zonedMonthStart(y, m, tz), to: zonedMonthStart(y, m + 1, tz) };
}

/** The month before the given one. */
export function previousMonth(r: MonthRange, timeZone = "UTC"): MonthRange {
  const [y, m] = r.key.split("-").map(Number);
  const prev = new Date(Date.UTC(y, m - 2, 1));
  return monthRange(monthKey(prev.getUTCFullYear(), prev.getUTCMonth()), r.from, timeZone);
}

/** The current month and the `count - 1` before it, newest first. */
export function monthOptions(now = new Date(), count = 12, timeZone = "UTC"): { key: string; label: string }[] {
  const today = zoned(now, safeTimeZone(timeZone));
  const out: { key: string; label: string }[] = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(Date.UTC(today.y, today.m - i, 1));
    out.push({ key: monthKey(d.getUTCFullYear(), d.getUTCMonth()), label: i === 0 ? "This month" : monthLabel(d.getUTCFullYear(), d.getUTCMonth()) });
  }
  return out;
}

export type Trend = { dir: "up" | "down" | "flat"; text: string };

/** Up/down arrow data compared with the month before, e.g. { dir: "up", text: "+3 vs October" }. */
export function trend(current: number, previous: number, previousLabel: string, format: (n: number) => string = String): Trend {
  const month = previousLabel.split(" ")[0];
  const diff = Math.round((current - previous) * 100) / 100;
  if (diff === 0) return { dir: "flat", text: `Same as ${month}` };
  return { dir: diff > 0 ? "up" : "down", text: `${diff > 0 ? "+" : "−"}${format(Math.abs(diff))} vs ${month}` };
}

export type Badge = { label: string; tone: "success" | "warning" | "critical" | "neutral" };

/** Businesses row: red when nobody gets perks (program off, or no active business). */
export function businessesBadge(programOn: boolean, activeBusinesses: number): Badge {
  if (!programOn) return { label: "Perks off", tone: "critical" };
  if (activeBusinesses === 0) return { label: "No active business", tone: "critical" };
  return { label: "Active", tone: "success" };
}

/** Storefront row: Employee mode in the live theme. null = couldn't read the theme. */
export function storefrontStatus(on: boolean | null, canReadThemes: boolean): { status: string; badge: Badge } {
  if (on === true) return { status: "Employee prices and hidden products", badge: { label: "On", tone: "success" } };
  if (on === false) return { status: "Employee mode is off in your theme", badge: { label: "Off", tone: "warning" } };
  if (!canReadThemes)
    return { status: "Approve the app's new permissions so we can check your theme", badge: { label: "Needs permission", tone: "warning" } };
  return { status: "Couldn't read your theme. Open to check again", badge: { label: "Couldn't check", tone: "warning" } };
}
