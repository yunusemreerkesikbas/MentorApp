import { describe, expect, it } from "vitest";
import {
  MentorshipRiskFlag,
  type MentorshipRiskFlagId,
  type MentorshipRosterRowDto,
} from "@mentor/types";
import { compareByAttention, summarizeCohort } from "./cohort-summary";

function row(
  over: {
    riskFlags?: MentorshipRiskFlagId[];
    /** Defaults to "flagged means waiting" — the server's answer before any mark is taken. */
    needsAttention?: boolean;
    planCompletionRate7d?: number | null;
    metrics?: null;
  } = {},
): MentorshipRosterRowDto {
  return {
    linkId: "link",
    studentId: "student",
    studentDisplayName: "Ada",
    studentUsername: null,
    avatarUrl: null,
    status: "ACTIVE",
    acceptedAt: "2026-09-01T00:00:00.000Z",
    endedAt: null,
    riskFlags: over.riskFlags ?? [],
    attendedAt: over.needsAttention === false ? "2026-09-05T09:00:00.000Z" : null,
    needsAttention: over.needsAttention ?? (over.riskFlags ?? []).length > 0,
    metrics:
      over.metrics === null
        ? null
        : {
            lastActiveDate: "2026-09-04",
            currentStreak: 3,
            focusMinutes7d: 240,
            sessions7d: 6,
            activeDays7d: 4,
            planCompletionRate7d:
              over.planCompletionRate7d === undefined ? 0.5 : over.planCompletionRate7d,
            latestMockNet: 60,
            latestMockAt: "2026-09-02",
            moodLevel7dAvg: 4,
          },
  };
}

describe("summarizeCohort", () => {
  it("counts a student once for attention and once per flag", () => {
    const summary = summarizeCohort([
      row({ riskFlags: [MentorshipRiskFlag.INACTIVE, MentorshipRiskFlag.LOW_MOOD] }),
      row({ riskFlags: [MentorshipRiskFlag.INACTIVE] }),
      row(),
    ]);
    expect(summary.total).toBe(3);
    expect(summary.needsAttention).toBe(2);
    expect(summary.flagCounts).toEqual([
      { flag: MentorshipRiskFlag.INACTIVE, count: 2 },
      { flag: MentorshipRiskFlag.LOW_MOOD, count: 1 },
    ]);
  });

  it("orders flags worst first and drops the ones nobody carries", () => {
    const summary = summarizeCohort([
      row({ riskFlags: [MentorshipRiskFlag.PLAN_SLIPPING] }),
      row({ riskFlags: [MentorshipRiskFlag.INACTIVE] }),
    ]);
    expect(summary.flagCounts.map((entry) => entry.flag)).toEqual([
      MentorshipRiskFlag.INACTIVE,
      MentorshipRiskFlag.PLAN_SLIPPING,
    ]);
  });

  // The load-bearing one: a student who planned nothing is silence, not a 0% completion. Counting
  // them as zero would report a cohort that never opened the plan screen as one that plans and
  // fails, and a coach would act on the wrong problem.
  it("leaves students who planned nothing out of the average entirely", () => {
    const summary = summarizeCohort([
      row({ planCompletionRate7d: 0.8 }),
      row({ planCompletionRate7d: null }),
      row({ planCompletionRate7d: null }),
    ]);
    expect(summary.planAdherence).toBe(0.8);
    expect(summary.planAdherenceOf).toBe(1);
    expect(summary.total).toBe(3);
  });

  it("reports no average rather than zero when nobody planned", () => {
    const summary = summarizeCohort([row({ planCompletionRate7d: null })]);
    expect(summary.planAdherence).toBeNull();
    expect(summary.planAdherenceOf).toBe(0);
  });

  it("skips rows whose window is closed", () => {
    // An ENDED link carries `metrics: null`. The roster's ACTIVE tab never sends one, but the
    // average must not treat a revoked window as a planless student either way.
    const summary = summarizeCohort([row({ planCompletionRate7d: 0.4 }), row({ metrics: null })]);
    expect(summary.planAdherence).toBe(0.4);
    expect(summary.planAdherenceOf).toBe(1);
  });

  it("has nothing to say about an empty roster", () => {
    expect(summarizeCohort([])).toEqual({
      total: 0,
      needsAttention: 0,
      attended: 0,
      flagCounts: [],
      planAdherence: null,
      planAdherenceOf: 0,
    });
  });

  // The point of the mark: the band stops nagging about a student the coach already called, while
  // still saying the flag is there. Counting the raw flags would make marking pointless; hiding
  // the chip would make the band lie about the cohort.
  it("moves a handled student out of the waiting count without hiding their flag", () => {
    const summary = summarizeCohort([
      row({ riskFlags: [MentorshipRiskFlag.INACTIVE], needsAttention: false }),
      row({ riskFlags: [MentorshipRiskFlag.INACTIVE] }),
    ]);
    expect(summary.needsAttention).toBe(1);
    expect(summary.attended).toBe(1);
    expect(summary.flagCounts).toEqual([{ flag: MentorshipRiskFlag.INACTIVE, count: 2 }]);
  });

  it("does not count a calm student as handled", () => {
    // `attended` is "flagged but dealt with", not "not waiting" — otherwise every healthy student
    // would inflate it and the band would claim work the coach never did.
    expect(summarizeCohort([row()]).attended).toBe(0);
  });
});

describe("compareByAttention", () => {
  it("sinks handled rows below waiting ones, and calm rows below both", () => {
    const waiting = row({ riskFlags: [MentorshipRiskFlag.INACTIVE] });
    const handled = row({ riskFlags: [MentorshipRiskFlag.LOW_MOOD], needsAttention: false });
    const calm = row();
    expect([calm, handled, waiting].sort(compareByAttention)).toEqual([waiting, handled, calm]);
  });

  it("leaves the API's severity order alone inside a band", () => {
    // Array.prototype.sort is stable, so equal ranks keep the order the server ranked them in.
    const worse = row({ riskFlags: [MentorshipRiskFlag.INACTIVE] });
    const milder = row({ riskFlags: [MentorshipRiskFlag.PLAN_SLIPPING] });
    expect([worse, milder].sort(compareByAttention)).toEqual([worse, milder]);
  });
});
