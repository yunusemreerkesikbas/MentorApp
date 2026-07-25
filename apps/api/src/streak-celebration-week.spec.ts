import { describe, expect, it } from "vitest";
import {
  celebrationLitCount,
  celebrationWeekIsos,
  isCelebrationDayLit,
} from "../../web/src/lib/streak-celebration";

describe("celebration week lighting", () => {
  it("caps lit slots at 7 while title can show higher counts", () => {
    expect(celebrationLitCount(2)).toBe(2);
    expect(celebrationLitCount(15)).toBe(7);
  });

  it("starts the week on the first active day (left) through today", () => {
    // 2-day streak on Sat 25 → Fri 24 … Thu 30; first two lit
    expect(celebrationWeekIsos(2, "2026-07-25")).toEqual([
      "2026-07-24",
      "2026-07-25",
      "2026-07-26",
      "2026-07-27",
      "2026-07-28",
      "2026-07-29",
      "2026-07-30",
    ]);
    expect(isCelebrationDayLit(0, 2)).toBe(true);
    expect(isCelebrationDayLit(1, 2)).toBe(true);
    expect(isCelebrationDayLit(2, 2)).toBe(false);

    // 15-day streak → full week ending today, all lit
    expect(celebrationWeekIsos(15, "2026-07-25")).toEqual([
      "2026-07-19",
      "2026-07-20",
      "2026-07-21",
      "2026-07-22",
      "2026-07-23",
      "2026-07-24",
      "2026-07-25",
    ]);
    for (let i = 0; i < 7; i++) {
      expect(isCelebrationDayLit(i, 15)).toBe(true);
    }
  });
});
