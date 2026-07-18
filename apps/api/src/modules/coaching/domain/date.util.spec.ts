import { describe, expect, it } from "vitest";
import {
  addDays,
  daysBetween,
  formatTurkishDate,
  isoWeekKey,
  isoWeekStart,
  monthKey,
  toIsoDate,
} from "./date.util";

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

  it("derives the ISO week key (Monday start, zero-padded)", () => {
    expect(isoWeekKey("2026-07-13")).toBe("2026-W29"); // Monday
    expect(isoWeekKey("2026-07-19")).toBe("2026-W29"); // Sunday, same week
    expect(isoWeekKey("2026-07-20")).toBe("2026-W30"); // next Monday
    expect(isoWeekKey("2026-01-05")).toBe("2026-W02");
  });

  it("assigns year-boundary days to the ISO week year (Thursday rule)", () => {
    // 2026-01-01 is a Thursday → week 1 of 2026; 2025-12-29 (Mon) opens that same week.
    expect(isoWeekKey("2025-12-29")).toBe("2026-W01");
    expect(isoWeekKey("2026-01-01")).toBe("2026-W01");
    // 2027-01-01 is a Friday → still week 53 of 2026.
    expect(isoWeekKey("2027-01-01")).toBe("2026-W53");
    expect(isoWeekKey("2026-12-28")).toBe("2026-W53"); // Monday of that W53
  });

  it("finds the Monday of the ISO week", () => {
    expect(isoWeekStart("2026-07-13")).toBe("2026-07-13"); // Monday is itself
    expect(isoWeekStart("2026-07-19")).toBe("2026-07-13"); // Sunday → back to Monday
    expect(isoWeekStart("2026-01-01")).toBe("2025-12-29"); // year boundary
  });
});
