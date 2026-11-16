/** Date ranges for reports and invoices. End is exclusive. Dates are UTC days. */
export type Preset = "this_week" | "last_week" | "this_month" | "last_month" | "this_year" | "custom";

export type Range = { from: Date; to: Date; label: string };

const DAY = 86_400_000;
const utcDay = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
export const ymd = (d: Date) => d.toISOString().slice(0, 10);

export function rangeFor(preset: string, now = new Date(), fromStr?: string | null, toStr?: string | null): Range {
  const today = utcDay(now);
  const monday = new Date(today.getTime() - ((today.getUTCDay() + 6) % 7) * DAY);
  const monthStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
  switch (preset) {
    case "this_week":
      return { from: monday, to: new Date(monday.getTime() + 7 * DAY), label: "This week" };
    case "last_week":
      return { from: new Date(monday.getTime() - 7 * DAY), to: monday, label: "Last week" };
    case "last_month": {
      const from = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 1, 1));
      return { from, to: monthStart, label: "Last month" };
    }
    case "this_year":
      return {
        from: new Date(Date.UTC(today.getUTCFullYear(), 0, 1)),
        to: new Date(Date.UTC(today.getUTCFullYear() + 1, 0, 1)),
        label: "This year",
      };
    case "custom": {
      const f = /^\d{4}-\d{2}-\d{2}$/.test(fromStr ?? "") ? new Date(`${fromStr}T00:00:00Z`) : null;
      const t = /^\d{4}-\d{2}-\d{2}$/.test(toStr ?? "") ? new Date(`${toStr}T00:00:00Z`) : null;
      if (f && t && !isNaN(f.getTime()) && !isNaN(t.getTime()) && f.getTime() <= t.getTime())
        return { from: f, to: new Date(t.getTime() + DAY), label: `${fromStr} to ${toStr}` };
      break;
    }
  }
  return {
    from: monthStart,
    to: new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 1)),
    label: "This month",
  };
}

/** Inclusive last day for display. */
export const lastDay = (r: { to: Date }) => ymd(new Date(r.to.getTime() - DAY));

const isMonthStart = (d: Date) => d.getUTCDate() === 1;

/** The period before: the previous calendar month/year when the range is whole months/years, else the same length earlier. */
export function previousRange(r: Range): Range {
  const months = (r.to.getUTCFullYear() - r.from.getUTCFullYear()) * 12 + r.to.getUTCMonth() - r.from.getUTCMonth();
  if (isMonthStart(r.from) && isMonthStart(r.to) && months > 0) {
    const from = new Date(Date.UTC(r.from.getUTCFullYear(), r.from.getUTCMonth() - months, 1));
    return { from, to: r.from, label: "previous period" };
  }
  const len = r.to.getTime() - r.from.getTime();
  return { from: new Date(r.from.getTime() - len), to: r.from, label: "previous period" };
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Readable range, end exclusive: "1–30 Nov 2026", "28 Oct – 3 Nov 2026", "1 Jan – 31 Dec 2026", "30 Dec 2025 – 5 Jan 2026". */
export function prettyRange(from: Date, toExclusive: Date): string {
  const to = new Date(toExclusive.getTime() - DAY);
  const d = (x: Date) => x.getUTCDate();
  const m = (x: Date) => MONTHS[x.getUTCMonth()];
  const y = (x: Date) => x.getUTCFullYear();
  if (y(from) !== y(to)) return `${d(from)} ${m(from)} ${y(from)} – ${d(to)} ${m(to)} ${y(to)}`;
  if (from.getUTCMonth() !== to.getUTCMonth()) return `${d(from)} ${m(from)} – ${d(to)} ${m(to)} ${y(to)}`;
  if (d(from) === d(to)) return `${d(from)} ${m(from)} ${y(from)}`;
  return `${d(from)}–${d(to)} ${m(to)} ${y(to)}`;
}

export function csvEscape(v: unknown) {
  const s = String(v ?? "");
  // Neutralise spreadsheet formulas, then quote.
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return /[",\n\r]/.test(safe) || safe !== s ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function toCsv(rows: (string | number)[][]) {
  return rows.map((r) => r.map(csvEscape).join(",")).join("\r\n") + "\r\n";
}
