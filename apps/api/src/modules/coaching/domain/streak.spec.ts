import { describe, expect, it } from "vitest";
import { FREEZE_TOKENS_PER_MONTH } from "./coaching.constants";
import { deriveStreak } from "./streak";

const TODAY = "2026-06-10";

/** Build a set of active dates from yyyy-mm-dd strings. */
function active(...dates: string[]): Set<string> {
  return new Set(dates);
}

describe("deriveStreak", () => {
  it("counts a run of consecutive active days ending today", () => {
    const result = deriveStreak(
      TODAY,
      active("2026-06-08", "2026-06-09", "2026-06-10"),
      FREEZE_TOKENS_PER_MONTH,
    );
    expect(result.currentStreak).toBe(3);
    expect(result.bridgedDates).toEqual([]);
  });

  it("does not break when today is not active yet (day in progress)", () => {
    // Today inactive, but yesterday + before are active → streak counts the run up to yesterday.
    const result = deriveStreak(
      TODAY,
      active("2026-06-08", "2026-06-09"),
      FREEZE_TOKENS_PER_MONTH,
    );
    expect(result.currentStreak).toBe(2);
  });

  it("bridges a single missed day with one freeze token", () => {
    // 06-08 active, 06-09 MISSED, 06-10 active → one freeze bridges the gap.
    const result = deriveStreak(TODAY, active("2026-06-08", "2026-06-10"), FREEZE_TOKENS_PER_MONTH);
    expect(result.currentStreak).toBe(2);
    expect(result.bridgedDates).toEqual(["2026-06-09"]);
  });

  it("soft-resets on a missed day when no freeze tokens remain", () => {
    // Same single gap but zero allowance → streak is just today.
    const result = deriveStreak(TODAY, active("2026-06-08", "2026-06-10"), 0);
    expect(result.currentStreak).toBe(1);
    expect(result.bridgedDates).toEqual([]);
  });

  it("breaks on two consecutive missed days even with freeze tokens", () => {
    // 06-07 active, 06-08 + 06-09 MISSED, 06-10 active → gap too large to bridge.
    const result = deriveStreak(TODAY, active("2026-06-07", "2026-06-10"), FREEZE_TOKENS_PER_MONTH);
    expect(result.currentStreak).toBe(1);
    expect(result.bridgedDates).toEqual([]);
  });

  it("uses at most the allowed number of freezes across multiple single gaps", () => {
    // gaps on 06-09, 06-07, 06-05 (each single) → with 2 tokens, bridge the two most recent only.
    const result = deriveStreak(
      TODAY,
      active("2026-06-10", "2026-06-08", "2026-06-06", "2026-06-04"),
      2,
    );
    // 06-10 ✓, bridge 06-09, 06-08 ✓, bridge 06-07, 06-06 ✓, then 06-05 missed with no tokens → stop.
    expect(result.currentStreak).toBe(3);
    expect(result.bridgedDates).toEqual(["2026-06-09", "2026-06-07"]);
  });

  it("returns zero when there is no activity at all", () => {
    const result = deriveStreak(TODAY, active(), FREEZE_TOKENS_PER_MONTH);
    expect(result.currentStreak).toBe(0);
  });

  it("resets freeze tokens per calendar month when walking backward", () => {
    // June: one bridged gap (06-09). May: two bridged gaps (05-30, 05-27).
    // Without per-month reset, only 2 tokens total → the second May gap would fail.
    const result = deriveStreak(
      "2026-06-10",
      active(
        "2026-06-10",
        "2026-06-08",
        "2026-06-07",
        "2026-06-06",
        "2026-06-05",
        "2026-06-04",
        "2026-06-03",
        "2026-06-02",
        "2026-06-01",
        "2026-05-31",
        "2026-05-29",
        "2026-05-28",
        "2026-05-26",
        "2026-05-24",
        "2026-05-22",
      ),
      2,
    );
    expect(result.bridgedDates).toEqual(["2026-06-09", "2026-05-30", "2026-05-27"]);
    expect(result.currentStreak).toBe(13);
  });
});
