import { describe, expect, it } from "vitest";
import { countLine, monthOptions, monthRange, plural, previousMonth, trend } from "../app/lib/home";

const NOW = new Date("2026-11-10T08:00:00Z");

describe("monthRange", () => {
  it("defaults to the current month", () => {
    const r = monthRange(null, NOW);
    expect(r.key).toBe("2026-11");
    expect(r.label).toBe("November 2026");
    expect(r.from.toISOString()).toBe("2026-11-01T00:00:00.000Z");
    expect(r.to.toISOString()).toBe("2026-12-01T00:00:00.000Z");
  });
  it("accepts past months and rejects future or bad ones", () => {
    expect(monthRange("2026-03", NOW).key).toBe("2026-03");
    expect(monthRange("2025-12", NOW).key).toBe("2025-12");
    expect(monthRange("2026-12", NOW).key).toBe("2026-11");
    expect(monthRange("2026-13", NOW).key).toBe("2026-11");
    expect(monthRange("nope", NOW).key).toBe("2026-11");
  });
  it("finds the month before, across years", () => {
    expect(previousMonth(monthRange("2026-01", NOW)).key).toBe("2025-12");
    expect(previousMonth(monthRange(null, NOW)).label).toBe("October 2026");
  });
});

describe("monthOptions", () => {
  it("lists this month first and goes back", () => {
    const o = monthOptions(NOW, 3);
    expect(o).toEqual([
      { key: "2026-11", label: "This month" },
      { key: "2026-10", label: "October 2026" },
      { key: "2026-09", label: "September 2026" },
    ]);
  });
});

describe("trend", () => {
  it("shows direction and change against the previous month", () => {
    expect(trend(5, 2, "October 2026")).toEqual({ dir: "up", text: "+3 vs October" });
    expect(trend(2, 5, "October 2026")).toEqual({ dir: "down", text: "−3 vs October" });
    expect(trend(4, 4, "October 2026")).toEqual({ dir: "flat", text: "Same as October" });
  });
  it("formats money and avoids float noise", () => {
    expect(trend(0.3, 0.1, "May 2026", (n) => `PKR ${n}`)).toEqual({ dir: "up", text: "+PKR 0.2 vs May" });
  });
});

describe("countLine", () => {
  it("always shows the first part and drops other zeros", () => {
    expect(countLine([[1, "active"], [0, "paused"]])).toBe("1 active");
    expect(countLine([[0, "active"], [2, "paused"]])).toBe("0 active · 2 paused");
    expect(countLine([[3, "active"], [1, "removed"]])).toBe("3 active · 1 removed");
  });
});

describe("plural", () => {
  it("picks the right form", () => {
    expect(plural(1, "order")).toBe("1 order");
    expect(plural(2, "order")).toBe("2 orders");
    expect(plural(0, "business", "businesses")).toBe("0 businesses");
  });
});
