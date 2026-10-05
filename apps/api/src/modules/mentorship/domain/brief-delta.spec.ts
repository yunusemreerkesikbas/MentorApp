import { describe, expect, it } from "vitest";
import { MentorshipRiskFlag, type MentorshipStudentReportDto } from "@mentor/types";
import {
  buildBriefDelta,
  buildBriefSnapshot,
  countAssignments,
  countDroppedSince,
  countMocksSince,
  type BriefSnapshot,
} from "./brief-delta";

const INACTIVE = MentorshipRiskFlag.INACTIVE;
const LOW_MOOD = MentorshipRiskFlag.LOW_MOOD;
const PLAN_SLIPPING = MentorshipRiskFlag.PLAN_SLIPPING;

const PREVIOUS_AT = "2026-09-05T09:00:00.000Z";

/** A report with nothing in it; each test fills in only the fields it is about. */
function report(
  overrides: Partial<MentorshipStudentReportDto> = {},
): MentorshipStudentReportDto {
  return {
    studentId: "11111111-1111-4111-8111-111111111111",
    studentDisplayName: "Deniz",
    studentUsername: null,
    acceptedAt: "2026-08-01T00:00:00.000Z",
    studentExamType: "KPSS",
    coachNote: null,
    riskFlags: [],
    attendedAt: null,
    needsAttention: false,
    activity: {
      lastActiveDate: "2026-09-12",
      currentStreak: 0,
      longestStreak: 0,
      sessions7d: 0,
      focusMinutes7d: 0,
      activeDays7d: 0,
      sessions28d: 0,
      focusMinutes28d: 0,
      activeDays28d: 0,
    },
    planCompletionRate7d: null,
    mockTrend: [],
    latestMockSubjects: [],
    planTasks: [],
    droppedAssignments: [],
    moodTrend: [],
    ...overrides,
  };
}

function snapshot(overrides: Partial<BriefSnapshot> = {}): BriefSnapshot {
  return {
    riskFlags: [],
    planCompletionRate7d: null,
    sessions7d: 0,
    focusMinutes7d: 0,
    activeDays7d: 0,
    latestMockAt: null,
    latestNet: null,
    moodMean: null,
    attendedAt: null,
    ...overrides,
  };
}

const NO_FOLLOWUPS = { followupsOpened: 0, followupsClosed: 0 };

const delta = (
  previous: BriefSnapshot,
  current: MentorshipStudentReportDto,
  followups = NO_FOLLOWUPS,
) => buildBriefDelta({ snapshot: previous, generatedAt: PREVIOUS_AT }, current, followups);

describe("buildBriefSnapshot", () => {
  it("reads the latest mock off the front, because the trend is newest-first", () => {
    const result = buildBriefSnapshot(
      report({
        mockTrend: [
          { takenAt: "2026-09-10", totalNet: 62, publisherName: null },
          { takenAt: "2026-09-01", totalNet: 48, publisherName: null },
        ],
      }),
    );
    expect(result.latestMockAt).toBe("2026-09-10");
    expect(result.latestNet).toBe(62);
  });

  it("averages the mood window and rounds to two decimals", () => {
    const result = buildBriefSnapshot(
      report({
        moodTrend: [
          { date: "2026-09-12", level: 4 },
          { date: "2026-09-11", level: 3 },
          { date: "2026-09-10", level: 2 },
        ],
      }),
    );
    expect(result.moodMean).toBe(3);
  });

  it("keeps an absent signal null rather than calling it zero", () => {
    const result = buildBriefSnapshot(report());
    expect(result.moodMean).toBeNull();
    expect(result.latestNet).toBeNull();
    expect(result.planCompletionRate7d).toBeNull();
  });
});

describe("countMocksSince", () => {
  const trend = [{ takenAt: "2026-09-10" }, { takenAt: "2026-09-03" }];

  it("counts only attempts after the previous brief's newest one", () => {
    expect(countMocksSince(trend, "2026-09-03")).toBe(1);
  });

  it("counts nothing when there is no previous attempt to measure from", () => {
    // A first brief must not report the student's whole history as "since last time".
    expect(countMocksSince(trend, null)).toBe(0);
  });
});

describe("countAssignments", () => {
  it("counts the coach's own rows from the previous brief's Istanbul day onwards", () => {
    const result = countAssignments(
      report({
        planTasks: [
          task("2026-09-06", true, "DONE"),
          task("2026-09-07", true, "PENDING"),
          // Before the boundary, and someone else's row on the right side of it.
          task("2026-09-01", true, "DONE"),
          task("2026-09-08", false, "DONE"),
        ],
      }),
      PREVIOUS_AT,
    );
    expect(result).toEqual({ scheduled: 2, completed: 1 });
  });

  it("puts a late-evening UTC brief on the Istanbul day it was actually written", () => {
    // 21:30 UTC is already the next day in Istanbul; a UTC slice would set the boundary a day early
    // and count a task the coach assigned before the brief they are reading.
    const result = countAssignments(
      report({ planTasks: [task("2026-09-05", true, "PENDING")] }),
      "2026-09-05T21:30:00.000Z",
    );
    expect(result.scheduled).toBe(0);
  });
});

describe("countDroppedSince", () => {
  it("counts removals after the previous brief only", () => {
    expect(
      countDroppedSince(
        [{ droppedAt: "2026-09-08T10:00:00.000Z" }, { droppedAt: "2026-09-01T10:00:00.000Z" }],
        PREVIOUS_AT,
      ),
    ).toBe(1);
  });
});

describe("buildBriefDelta", () => {
  it("names the flags that arrived and the ones that cleared", () => {
    const result = delta(
      snapshot({ riskFlags: [INACTIVE, LOW_MOOD] }),
      report({ riskFlags: [LOW_MOOD, PLAN_SLIPPING] }),
    );
    expect(result.flagsAdded).toEqual([PLAN_SLIPPING]);
    expect(result.flagsResolved).toEqual([INACTIVE]);
  });

  it("reports a metric that moved, with the subtraction already done", () => {
    const result = delta(
      snapshot({ planCompletionRate7d: 0.4 }),
      report({ planCompletionRate7d: 0.72 }),
    );
    expect(result.planCompletion).toEqual({ previous: 0.4, current: 0.72, change: 0.32 });
  });

  it("treats an unchanged number as nothing to say", () => {
    const result = delta(snapshot({ sessions7d: 5 }), report({ ...activity(5) }));
    expect(result.sessions7d).toBeNull();
  });

  it("does not turn first-time data into an improvement", () => {
    // No check-ins last week, three this week. That is not a rise of 4.0 from nothing.
    const result = delta(
      snapshot({ moodMean: null }),
      report({ moodTrend: [{ date: "2026-09-12", level: 4 }] }),
    );
    expect(result.moodMean).toBeNull();
  });

  it("does not read a fall to zero into data that simply went missing", () => {
    const result = delta(
      snapshot({ planCompletionRate7d: 0.8 }),
      report({ planCompletionRate7d: null }),
    );
    expect(result.planCompletion).toBeNull();
  });

  describe("coach actions", () => {
    it("reports a mark the coach made since the previous brief", () => {
      const result = delta(
        snapshot({ attendedAt: null }),
        report({ attendedAt: "2026-09-08T12:00:00.000Z" }),
      );
      expect(result.coachActions.attended).toBe(true);
    });

    it("does not re-report a mark the previous brief already carried", () => {
      const marked = "2026-09-01T12:00:00.000Z";
      const result = delta(snapshot({ attendedAt: marked }), report({ attendedAt: marked }));
      expect(result.coachActions.attended).toBe(false);
    });

    it("carries the follow-up counts it was handed", () => {
      const result = delta(snapshot(), report(), {
        followupsOpened: 2,
        followupsClosed: 1,
      });
      expect(result.coachActions.followupsOpened).toBe(2);
      expect(result.coachActions.followupsClosed).toBe(1);
    });
  });

  describe("quiet", () => {
    it("is true when nothing moved and the coach did nothing", () => {
      expect(delta(snapshot(), report()).quiet).toBe(true);
    });

    it("is false when only the coach moved", () => {
      const result = delta(snapshot(), report(), { followupsOpened: 1, followupsClosed: 0 });
      expect(result.quiet).toBe(false);
    });

    it("is false when only a metric moved", () => {
      expect(delta(snapshot({ activeDays7d: 1 }), report({ ...activity(0, 0, 4) })).quiet).toBe(
        false,
      );
    });
  });

  it("carries the previous brief's timestamp so the band can date itself", () => {
    expect(delta(snapshot(), report()).previousGeneratedAt).toBe(PREVIOUS_AT);
  });
});

function task(taskDate: string, assignedByCoach: boolean, status: string) {
  return { taskDate, title: "Deneme", subject: null, topic: null, status, assignedByCoach, coachNote: null };
}

function activity(sessions7d = 0, focusMinutes7d = 0, activeDays7d = 0) {
  return {
    activity: {
      lastActiveDate: "2026-09-12",
      currentStreak: 0,
      longestStreak: 0,
      sessions7d,
      focusMinutes7d,
      activeDays7d,
      sessions28d: 0,
      focusMinutes28d: 0,
      activeDays28d: 0,
    },
  };
}
