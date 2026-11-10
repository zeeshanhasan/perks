/** Helpers for the Home page. Pure, so they're unit-tested. */

/** "1 active · 2 paused" style status lines, leaving out zero parts except the first. */
export function countLine(parts: [number, string][]): string {
  const shown = parts.filter(([n], i) => i === 0 || n > 0);
  return shown.map(([n, label]) => `${n} ${label}`).join(" · ");
}

export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

// --- Month picker -----------------------------------------------------------------------

export type MonthRange = { key: string; label: string; from: Date; to: Date };

const monthKey = (y: number, m: number) => `${y}-${String(m + 1).padStart(2, "0")}`;
const monthLabel = (y: number, m: number) =>
  new Date(Date.UTC(y, m, 1)).toLocaleString("en", { month: "long", year: "numeric", timeZone: "UTC" });

/** The month for "YYYY-MM" (UTC), or the current month when the key is missing, malformed or in the future. */
export function monthRange(key: string | null | undefined, now = new Date()): MonthRange {
  let y = now.getUTCFullYear();
  let m = now.getUTCMonth();
  const match = /^(\d{4})-(\d{2})$/.exec(key ?? "");
  if (match) {
    const ky = Number(match[1]);
    const km = Number(match[2]) - 1;
    if (km >= 0 && km <= 11 && (ky < y || (ky === y && km <= m))) {
      y = ky;
      m = km;
    }
  }
  return { key: monthKey(y, m), label: monthLabel(y, m), from: new Date(Date.UTC(y, m, 1)), to: new Date(Date.UTC(y, m + 1, 1)) };
}

/** The month before the given one. */
export function previousMonth(r: MonthRange): MonthRange {
  const d = new Date(r.from.getTime());
  d.setUTCMonth(d.getUTCMonth() - 1);
  return monthRange(monthKey(d.getUTCFullYear(), d.getUTCMonth()), r.from);
}

/** The current month and the `count - 1` before it, newest first. */
export function monthOptions(now = new Date(), count = 12): { key: string; label: string }[] {
  const out: { key: string; label: string }[] = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
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
