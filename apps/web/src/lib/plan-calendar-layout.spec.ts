// The repository reuses apps/api's Vitest runner; apps/web intentionally has no test dependency.
// @ts-expect-error -- resolved by the explicit @mentor/api Vitest command used for this spec.
import { describe, expect, it } from "vitest";
import {
  DAY_MINUTES,
  earliestStartMinute,
  hhmmFromMinutes,
  layoutDayEvents,
  minutesFromHhmm,
  monthGridDays,
} from "./plan-calendar-layout";
import { planEventColor } from "./plan-event-colors";

const at = (startTime: string | null, endTime: string | null = null, id = startTime ?? "all") => ({
  id,
  startTime,
  endTime,
});

describe("minutesFromHhmm / hhmmFromMinutes", () => {
  it("round-trips wall-clock times", () => {
    expect(minutesFromHhmm("00:00")).toBe(0);
    expect(minutesFromHhmm("09:30")).toBe(570);
    expect(minutesFromHhmm("23:59")).toBe(1439);
    expect(hhmmFromMinutes(570)).toBe("09:30");
    expect(hhmmFromMinutes(0)).toBe("00:00");
  });

  it("clamps out-of-day minutes instead of overflowing the hour field", () => {
    expect(hhmmFromMinutes(-30)).toBe("00:00");
    expect(hhmmFromMinutes(DAY_MINUTES + 90)).toBe("23:59");
  });
});

describe("layoutDayEvents", () => {
  it("separates all-day items from timed blocks", () => {
    const { allDay, timed } = layoutDayEvents([at(null, null, "a"), at("09:00", "10:00")]);
    expect(allDay.map((e) => e.id)).toEqual(["a"]);
    expect(timed).toHaveLength(1);
    expect(timed[0]!.topPct).toBeCloseTo((540 / DAY_MINUTES) * 100);
    expect(timed[0]!.heightPct).toBeCloseTo((60 / DAY_MINUTES) * 100);
  });

  it("gives overlapping events their own lane and a shared column count", () => {
    const { timed } = layoutDayEvents([
      at("09:00", "11:00", "a"),
      at("10:00", "12:00", "b"),
    ]);
    expect(timed.map((t) => t.col)).toEqual([0, 1]);
    expect(timed.every((t) => t.colCount === 2)).toBe(true);
  });

  it("reuses a lane once the previous event in it has ended", () => {
    const { timed } = layoutDayEvents([
      at("09:00", "10:00", "a"),
      at("09:30", "12:00", "b"),
      at("10:00", "11:00", "c"),
    ]);
    const byId = Object.fromEntries(timed.map((t) => [t.event.id, t]));
    // a and c share lane 0 (c starts exactly when a ends); b holds lane 1 across both.
    expect(byId.a!.col).toBe(0);
    expect(byId.b!.col).toBe(1);
    expect(byId.c!.col).toBe(0);
    expect(byId.c!.colCount).toBe(2);
  });

  it("keeps non-overlapping events at full width", () => {
    const { timed } = layoutDayEvents([at("09:00", "10:00", "a"), at("14:00", "15:00", "b")]);
    expect(timed.map((t) => t.colCount)).toEqual([1, 1]);
  });

  it("handles a fully contained event", () => {
    const { timed } = layoutDayEvents([
      at("08:00", "18:00", "outer"),
      at("12:00", "13:00", "inner"),
    ]);
    expect(timed.map((t) => t.colCount)).toEqual([2, 2]);
    expect(timed.map((t) => t.col)).toEqual([0, 1]);
  });

  it("defaults an open-ended event to one hour", () => {
    const { timed } = layoutDayEvents([at("22:00")]);
    expect(timed[0]!.endMin).toBe(23 * 60);
  });

  it("clamps a block that would run past midnight", () => {
    const { timed } = layoutDayEvents([at("23:30", "23:59")]);
    expect(timed[0]!.endMin).toBeLessThanOrEqual(DAY_MINUTES);
    expect(timed[0]!.topPct + timed[0]!.heightPct).toBeLessThanOrEqual(100);
  });

  it("never produces a zero or negative height for a malformed row", () => {
    const { timed } = layoutDayEvents([at("10:00", "09:00")]);
    expect(timed[0]!.heightPct).toBeGreaterThan(0);
  });

  it("orders timed blocks chronologically regardless of input order", () => {
    const { timed } = layoutDayEvents([at("15:00", "16:00", "b"), at("08:00", "09:00", "a")]);
    expect(timed.map((t) => t.event.id)).toEqual(["a", "b"]);
  });
});

describe("earliestStartMinute", () => {
  it("returns the earliest timed start, ignoring all-day items", () => {
    expect(earliestStartMinute([at(null), at("13:00"), at("07:15")], 420)).toBe(435);
  });

  it("falls back when the day has no timed item", () => {
    expect(earliestStartMinute([at(null)], 420)).toBe(420);
  });
});

describe("monthGridDays", () => {
  it("always returns a 6×7 Monday-start grid", () => {
    const days = monthGridDays(2026, 6); // July 2026
    expect(days).toHaveLength(42);
    expect(new Date(`${days[0]}T12:00:00`).getDay()).toBe(1);
    expect(days).toContain("2026-07-01");
    expect(days).toContain("2026-07-31");
  });

  it("starts on the Monday on or before the 1st", () => {
    // 2026-02-01 is a Sunday → the grid starts Monday 2026-01-26.
    expect(monthGridDays(2026, 1)[0]).toBe("2026-01-26");
    // 2026-06-01 is a Monday → the grid starts on it.
    expect(monthGridDays(2026, 5)[0]).toBe("2026-06-01");
  });

  it("produces consecutive days across a month boundary", () => {
    const days = monthGridDays(2025, 11); // December 2025 → spills into January
    expect(days).toContain("2026-01-01");
    for (let i = 1; i < days.length; i++) {
      const prev = new Date(`${days[i - 1]}T12:00:00`).getTime();
      const cur = new Date(`${days[i]}T12:00:00`).getTime();
      expect(Math.round((cur - prev) / 86_400_000)).toBe(1);
    }
  });
});

describe("planEventColor", () => {
  it("is deterministic for the same subject", () => {
    expect(planEventColor("Matematik")).toEqual(planEventColor("Matematik"));
    expect(planEventColor("Matematik ")).toEqual(planEventColor("Matematik"));
  });

  it("returns the neutral swatch when there is no subject", () => {
    const neutral = planEventColor(null);
    expect(planEventColor("")).toEqual(neutral);
    expect(planEventColor(undefined)).toEqual(neutral);
    expect(planEventColor("Matematik")).not.toEqual(neutral);
  });

  it("gives the five core KPSS subjects five distinct swatches", () => {
    // Guards the hash: `hash * 31 + c` with 31 ≡ 1 (mod 5) collapsed four of these onto one color.
    const bars = ["Matematik", "Türkçe", "Tarih", "Coğrafya", "Vatandaşlık"].map(
      (s) => planEventColor(s).bar,
    );
    expect(new Set(bars).size).toBe(bars.length);
  });
});
