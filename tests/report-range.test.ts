import { describe, expect, it } from "vitest";
import { prettyRange, previousRange, rangeFor } from "../app/lib/report";

const NOW = new Date("2026-11-16T08:00:00Z");
const day = (s: string) => new Date(`${s}T00:00:00Z`);

describe("prettyRange", () => {
  it("reads like a person would write it", () => {
    expect(prettyRange(day("2026-11-01"), day("2026-12-01"))).toBe("1–30 Nov 2026");
    expect(prettyRange(day("2026-10-28"), day("2026-11-04"))).toBe("28 Oct – 3 Nov 2026");
    expect(prettyRange(day("2026-01-01"), day("2027-01-01"))).toBe("1 Jan – 31 Dec 2026");
    expect(prettyRange(day("2025-12-30"), day("2026-01-06"))).toBe("30 Dec 2025 – 5 Jan 2026");
    expect(prettyRange(day("2026-11-16"), day("2026-11-17"))).toBe("16 Nov 2026");
  });
});

describe("previousRange", () => {
  it("uses the previous calendar month or year", () => {
    const m = previousRange(rangeFor("this_month", NOW));
    expect([m.from, m.to].map((d) => d.toISOString().slice(0, 10))).toEqual(["2026-10-01", "2026-11-01"]);
    const y = previousRange(rangeFor("this_year", NOW));
    expect([y.from, y.to].map((d) => d.toISOString().slice(0, 10))).toEqual(["2025-01-01", "2026-01-01"]);
  });
  it("shifts weeks and custom ranges by their length", () => {
    const w = previousRange(rangeFor("this_week", NOW));
    expect([w.from, w.to].map((d) => d.toISOString().slice(0, 10))).toEqual(["2026-11-09", "2026-11-16"]);
    const c = previousRange(rangeFor("custom", NOW, "2026-11-05", "2026-11-14"));
    expect([c.from, c.to].map((d) => d.toISOString().slice(0, 10))).toEqual(["2026-10-26", "2026-11-05"]);
  });
});
