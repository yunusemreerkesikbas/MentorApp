import { describe, expect, it } from "vitest";
import { MentorshipRiskFlag } from "@mentor/types";
import type { CohortStudentSnapshot } from "../../coaching/domain/cohort-evidence";
import { compareByRisk, evaluateRiskFlags, type RiskThresholds } from "./risk-flags";

const TODAY = "2026-09-10";
const THRESHOLDS: RiskThresholds = {
  inactiveDays: 3,
  planCompletionFloor: 0.5,
  lowMoodCeiling: 2,
};

/** A student doing fine: active today, plan on track, decent mood, net rising. */
function healthy(overrides: Partial<CohortStudentSnapshot> = {}): CohortStudentSnapshot {
  return {
    studentId: "s1",
    lastActiveDate: TODAY,
    currentStreak: 5,
    focusMinutes7d: 300,
    sessions7d: 8,
    activeDays7d: 6,
    planCompletionRate7d: 0.9,
    latestMockNet: 72,
    latestMockAt: "2026-09-08T10:00:00.000Z",
    previousMockNetAvg: 65,
    moodLevel7dAvg: 4,
    ...overrides,
  };
}

const flags = (overrides: Partial<CohortStudentSnapshot>) =>
  evaluateRiskFlags(healthy(overrides), THRESHOLDS, TODAY);

describe("evaluateRiskFlags", () => {
  it("flags nothing for a student who is doing fine", () => {
    expect(flags({})).toEqual([]);
  });

  describe("INACTIVE", () => {
    it("stays quiet exactly at the threshold", () => {
      expect(flags({ lastActiveDate: "2026-09-07" })).toEqual([]); // 3 days
    });

    it("fires one day past it", () => {
      expect(flags({ lastActiveDate: "2026-09-06" })).toEqual([MentorshipRiskFlag.INACTIVE]);
    });

    it("fires for a student who has never been active at all", () => {
      expect(flags({ lastActiveDate: null })).toContain(MentorshipRiskFlag.INACTIVE);
    });
  });

  describe("PLAN_SLIPPING", () => {
    it("stays quiet exactly at the floor", () => {
      expect(flags({ planCompletionRate7d: 0.5 })).toEqual([]);
    });

    it("fires below it", () => {
      expect(flags({ planCompletionRate7d: 0.49 })).toEqual([
        MentorshipRiskFlag.PLAN_SLIPPING,
      ]);
    });

    it("does NOT fire when nothing was planned — silence is not failure", () => {
      expect(flags({ planCompletionRate7d: null })).toEqual([]);
    });
  });

  describe("LOW_MOOD", () => {
    it("fires at the ceiling (inclusive)", () => {
      expect(flags({ moodLevel7dAvg: 2 })).toEqual([MentorshipRiskFlag.LOW_MOOD]);
    });

    it("stays quiet just above it", () => {
      expect(flags({ moodLevel7dAvg: 2.1 })).toEqual([]);
    });

    it("does NOT fire when the student never checked in", () => {
      expect(flags({ moodLevel7dAvg: null })).toEqual([]);
    });
  });

  describe("NET_DROP", () => {
    it("fires when the latest net is below the baseline", () => {
      expect(flags({ latestMockNet: 60, previousMockNetAvg: 65 })).toEqual([
        MentorshipRiskFlag.NET_DROP,
      ]);
    });

    it("holding steady is not slipping", () => {
      expect(flags({ latestMockNet: 65, previousMockNetAvg: 65 })).toEqual([]);
    });

    it("does NOT fire on a first attempt — there is nothing to fall from", () => {
      expect(flags({ latestMockNet: 20, previousMockNetAvg: null })).toEqual([]);
    });

    it("does NOT fire when the student has taken no mock at all", () => {
      expect(flags({ latestMockNet: null, previousMockNetAvg: null })).toEqual([]);
    });
  });

  it("returns multiple flags worst-first, not in evaluation order", () => {
    expect(
      flags({
        lastActiveDate: "2026-09-01",
        planCompletionRate7d: 0.1,
        moodLevel7dAvg: 1,
        latestMockNet: 40,
        previousMockNetAvg: 60,
      }),
    ).toEqual([
      MentorshipRiskFlag.INACTIVE,
      MentorshipRiskFlag.LOW_MOOD,
      MentorshipRiskFlag.NET_DROP,
      MentorshipRiskFlag.PLAN_SLIPPING,
    ]);
  });
});

describe("compareByRisk", () => {
  const row = (riskFlags: string[], lastActiveDate: string | null) =>
    ({ riskFlags, metrics: { lastActiveDate } }) as never;

  it("puts flagged students ahead of unflagged ones", () => {
    const rows = [
      row([], "2026-09-10"),
      row([MentorshipRiskFlag.PLAN_SLIPPING], "2026-09-10"),
      row([MentorshipRiskFlag.INACTIVE], "2026-09-01"),
    ];
    rows.sort(compareByRisk);
    expect(rows.map((r) => (r as { riskFlags: string[] }).riskFlags[0] ?? "none")).toEqual([
      MentorshipRiskFlag.INACTIVE,
      MentorshipRiskFlag.PLAN_SLIPPING,
      "none",
    ]);
  });

  it("breaks ties on staleness — the quietest student first", () => {
    const rows = [
      row([MentorshipRiskFlag.INACTIVE], "2026-09-05"),
      row([MentorshipRiskFlag.INACTIVE], "2026-09-01"),
    ];
    rows.sort(compareByRisk);
    expect((rows[0] as { metrics: { lastActiveDate: string } }).metrics.lastActiveDate).toBe(
      "2026-09-01",
    );
  });

  it("sinks a row with no metrics (an ended link) below the live ones", () => {
    const rows = [
      { riskFlags: [], metrics: null } as never,
      row([], "2026-09-01"),
    ];
    rows.sort(compareByRisk);
    expect((rows[0] as { metrics: unknown }).metrics).not.toBeNull();
  });

  it("puts a student who never started at the very top of their severity band", () => {
    const rows = [
      row([MentorshipRiskFlag.INACTIVE], "2026-09-01"),
      row([MentorshipRiskFlag.INACTIVE], null),
    ];
    rows.sort(compareByRisk);
    expect(
      (rows[0] as { metrics: { lastActiveDate: string | null } }).metrics.lastActiveDate,
    ).toBeNull();
  });
});
