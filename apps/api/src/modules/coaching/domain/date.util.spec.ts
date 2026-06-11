import { describe, expect, it } from "vitest";
import { addDays, daysBetween, formatTurkishDate, monthKey, toIsoDate } from "./date.util";

describe("date.util", () => {
  it("formats a Turkish display date", () => {
    expect(formatTurkishDate("2026-07-12")).toBe("12 Temmuz 2026");
    expect(formatTurkishDate("2026-01-01")).toBe("1 Ocak 2026");
    expect(formatTurkishDate("2026-12-31")).toBe("31 Aralık 2026");
  });

  it("computes whole days between two dates", () => {
    expect(daysBetween("2026-06-10", "2026-07-12")).toBe(32);
    expect(daysBetween("2026-07-12", "2026-06-10")).toBe(-32);
    expect(daysBetween("2026-06-10", "2026-06-10")).toBe(0);
  });

  it("adds days across month boundaries", () => {
    expect(addDays("2026-06-30", 1)).toBe("2026-07-01");
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31");
  });

  it("derives the YYYY-MM month key", () => {
    expect(monthKey("2026-06-10")).toBe("2026-06");
  });

  it("renders a Date as a UTC iso date", () => {
    expect(toIsoDate(new Date("2026-06-10T22:30:00Z"))).toBe("2026-06-10");
  });
});
