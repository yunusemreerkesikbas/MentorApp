import { describe, expect, it } from "vitest";
import {
  buildWeeklyActivitySummary,
  energySignal,
  istanbulFocusTimeBand,
  isWeeklyReviewReady,
  selectPositiveWeeklyComparison,
  selectWeeklyFocusTimeBand,
  selectWeeklyHighlights,
  selectWeeklyFocus,
  selectWeeklyNextStorySignals,
  selectWeeklyTitle,
  weeklyPlanSubjectBreakdown,
  weeklyPeakFocusDay,
  weeklyRecapStatus,
  weeklySessionSubjectBreakdown,
  weeklyReviewWindows,
} from "./weekly-review";

describe("weekly review rules", () => {
  it("uses the previous completed Istanbul Monday-Sunday window", () => {
    expect(weeklyReviewWindows(new Date("2026-07-11T12:00:00Z"))).toEqual({
      current: {
        start: new Date("2026-06-28T21:00:00.000Z"),
        end: new Date("2026-07-05T21:00:00.000Z"),
      },
      previous: {
        start: new Date("2026-06-21T21:00:00.000Z"),
        end: new Date("2026-06-28T21:00:00.000Z"),
      },
      startDate: "2026-06-29",
      endDate: "2026-07-05",
    });
  });

  it("keeps the legacy readiness helper compatible", () => {
    expect(isWeeklyReviewReady(1, 0)).toBe(true);
    expect(isWeeklyReviewReady(0, 2)).toBe(true);
    expect(isWeeklyReviewReady(0, 1)).toBe(false);
  });

  it.each([
    [
      {
        mockExamCount: 1,
        qualifyingSessionCount: 0,
        completedPlanTaskCount: 0,
      },
      "mock exam",
    ],
    [
      {
        mockExamCount: 0,
        qualifyingSessionCount: 2,
        completedPlanTaskCount: 0,
      },
      "session",
    ],
    [
      {
        mockExamCount: 0,
        qualifyingSessionCount: 0,
        completedPlanTaskCount: 3,
      },
      "plan task",
    ],
  ] as const)("marks the recap READY at the %s threshold", (evidence) => {
    expect(
      weeklyRecapStatus(evidence, {
        mockExamCount: 1,
        qualifyingSessionCount: 2,
        completedPlanTaskCount: 3,
      }),
    ).toBe("READY");
  });

  it("distinguishes PARTIAL from EMPTY without using mood as evidence", () => {
    const thresholds = {
      mockExamCount: 1,
      qualifyingSessionCount: 2,
      completedPlanTaskCount: 3,
    };

    expect(
      weeklyRecapStatus(
        {
          mockExamCount: 0,
          qualifyingSessionCount: 1,
          completedPlanTaskCount: 0,
        },
        thresholds,
      ),
    ).toBe("PARTIAL");
    expect(
      weeklyRecapStatus(
        {
          mockExamCount: 0,
          qualifyingSessionCount: 0,
          completedPlanTaskCount: 0,
        },
        thresholds,
      ),
    ).toBe("EMPTY");
  });

  it.each([
    [
      {
        status: "PARTIAL",
        mockExamCount: 0,
        qualifyingSessionCount: 0,
        completedPlanTaskCount: 1,
      },
      "FOCUS_SESSION",
    ],
    [
      {
        status: "PARTIAL",
        mockExamCount: 0,
        qualifyingSessionCount: 1,
        completedPlanTaskCount: 0,
      },
      "PLAN_TASK",
    ],
    [
      {
        status: "PARTIAL",
        mockExamCount: 0,
        qualifyingSessionCount: 1,
        completedPlanTaskCount: 1,
      },
      "MOCK_EXAM",
    ],
  ] as const)(
    "selects every missing next-week story signal for PARTIAL evidence",
    (input, expected) => {
      const expectedSignals = {
        FOCUS_SESSION: ["FOCUS_SESSION", "MOCK_EXAM"],
        PLAN_TASK: ["PLAN_TASK", "MOCK_EXAM"],
        MOCK_EXAM: ["MOCK_EXAM"],
      } as const;

      expect(selectWeeklyNextStorySignals(input)).toEqual(
        expectedSignals[expected],
      );
    },
  );

  it("does not create next-week story signals for READY or EMPTY", () => {
    expect(
      selectWeeklyNextStorySignals({
        status: "READY",
        mockExamCount: 0,
        qualifyingSessionCount: 2,
        completedPlanTaskCount: 0,
      }),
    ).toEqual([]);
    expect(
      selectWeeklyNextStorySignals({
        status: "EMPTY",
        mockExamCount: 0,
        qualifyingSessionCount: 0,
        completedPlanTaskCount: 0,
      }),
    ).toEqual([]);
  });

  it("builds the seven-day Istanbul rhythm and longest in-week run", () => {
    expect(
      buildWeeklyActivitySummary("2026-07-13", {
        mockExamDates: [new Date("2026-07-12T21:30:00.000Z")],
        qualifyingSessionDates: [
          new Date("2026-07-13T08:00:00.000Z"),
          new Date("2026-07-14T22:10:00.000Z"),
        ],
        completedPlanTaskDates: [
          "2026-07-14",
          "2026-07-16",
          "2026-07-18",
        ],
      }),
    ).toEqual({
      activeDays: 5,
      longestActiveRun: 4,
      days: [
        { date: "2026-07-13", active: true },
        { date: "2026-07-14", active: true },
        { date: "2026-07-15", active: true },
        { date: "2026-07-16", active: true },
        { date: "2026-07-17", active: false },
        { date: "2026-07-18", active: true },
        { date: "2026-07-19", active: false },
      ],
    });
  });

  it("includes only taxonomy-matched plan subjects without task titles", () => {
    expect(
      weeklyPlanSubjectBreakdown(
        [
          { subject: "Türkçe" },
          { subject: "turkce" },
          { subject: "Custom study area" },
          { subject: null },
        ],
        [
          { slug: "turkce", name: "Türkçe" },
          { slug: "matematik", name: "Matematik" },
        ],
      ),
    ).toEqual([
      {
        subjectRef: "turkce",
        subjectName: "Türkçe",
        completedTaskCount: 2,
      },
    ]);
  });

  it("aggregates focus seconds by verified subject and preserves taxonomy tie order", () => {
    expect(
      weeklySessionSubjectBreakdown(
        [
          { subject: "Matematik", actualFocusSeconds: 1_800 },
          { subject: "matematik", actualFocusSeconds: 1_200 },
          { subject: "Türkçe", actualFocusSeconds: 3_000 },
          { subject: "Private subject", actualFocusSeconds: 7_200 },
        ],
        [
          { slug: "matematik", name: "Matematik" },
          { slug: "turkce", name: "Türkçe" },
        ],
      ),
    ).toEqual([
      {
        subjectRef: "matematik",
        subjectName: "Matematik",
        focusMinutes: 50,
        qualifyingSessionCount: 2,
      },
      {
        subjectRef: "turkce",
        subjectName: "Türkçe",
        focusMinutes: 50,
        qualifyingSessionCount: 1,
      },
    ]);
  });

  it("selects one meaningful positive comparison by normalized delta and stable tie priority", () => {
    expect(
      selectPositiveWeeklyComparison(
        {
          focusMinutes: 150,
          longestSessionMinutes: 55,
          activeDays: 5,
          completedTaskCount: 4,
        },
        {
          focusMinutes: 120,
          longestSessionMinutes: 50,
          activeDays: 3,
          completedTaskCount: 2,
        },
        {
          focusMinutes: 15,
          longestSessionMinutes: 5,
          activeDays: 1,
          completedTaskCount: 1,
        },
      ),
    ).toEqual({
      metric: "ACTIVE_DAYS",
      current: 5,
      previous: 3,
      delta: 2,
    });

    expect(
      selectPositiveWeeklyComparison(
        {
          focusMinutes: 105,
          longestSessionMinutes: 51,
          activeDays: 3,
          completedTaskCount: 2,
        },
        {
          focusMinutes: 100,
          longestSessionMinutes: 50,
          activeDays: 3,
          completedTaskCount: 2,
        },
        {
          focusMinutes: 15,
          longestSessionMinutes: 5,
          activeDays: 1,
          completedTaskCount: 1,
        },
      ),
    ).toBeNull();
  });

  it("selects the dominant eligible weekly title and uses a READY fallback", () => {
    const thresholds = {
      longestActiveRun: 4,
      longestSessionMinutes: 50,
      completedPlanTaskCount: 3,
      focusedSubjectCount: 3,
      mockExamCount: 1,
      evidenceChannelCount: 2,
    };

    expect(
      selectWeeklyTitle(
        {
          status: "READY",
          longestActiveRun: 4,
          longestSessionMinutes: 80,
          completedPlanTaskCount: 4,
          focusedSubjectCount: 3,
          mockExamCount: 1,
          evidenceChannelCount: 3,
        },
        thresholds,
      ),
    ).toBe("FOCUS_DIVER");

    expect(
      selectWeeklyTitle(
        {
          status: "READY",
          longestActiveRun: 4,
          longestSessionMinutes: 50,
          completedPlanTaskCount: 3,
          focusedSubjectCount: 0,
          mockExamCount: 0,
          evidenceChannelCount: 2,
        },
        thresholds,
      ),
    ).toBe("BALANCE_MASTER");

    expect(
      selectWeeklyTitle(
        {
          status: "READY",
          longestActiveRun: 1,
          longestSessionMinutes: 10,
          completedPlanTaskCount: 0,
          focusedSubjectCount: 1,
          mockExamCount: 0,
          evidenceChannelCount: 1,
        },
        thresholds,
      ),
    ).toBe("FOCUS_TRAVELER");
    expect(
      selectWeeklyTitle(
        {
          status: "PARTIAL",
          longestActiveRun: 1,
          longestSessionMinutes: 10,
          completedPlanTaskCount: 0,
          focusedSubjectCount: 1,
          mockExamCount: 0,
          evidenceChannelCount: 1,
        },
        thresholds,
      ),
    ).toBeNull();
  });

  it("keeps at most two highlights in product priority order", () => {
    expect(
      selectWeeklyHighlights([
        { kind: "MOCK_EXAMS", mockExamCount: 2 },
        {
          kind: "TOP_FOCUS_SUBJECT",
          subjectRef: "matematik",
          subjectName: "Matematik",
          focusMinutes: 120,
        },
        { kind: "LONGEST_SESSION", minutes: 80 },
        {
          kind: "POSITIVE_COMPARISON",
          metric: "ACTIVE_DAYS",
          current: 5,
          previous: 3,
          delta: 2,
        },
      ]),
    ).toEqual([
      {
        kind: "POSITIVE_COMPARISON",
        metric: "ACTIVE_DAYS",
        current: 5,
        previous: 3,
        delta: 2,
      },
      { kind: "LONGEST_SESSION", minutes: 80 },
    ]);
  });

  it("maps aggregate mood averages", () => {
    expect(energySignal([])).toBeNull();
    expect(energySignal([2, 3])).toBe("LOW");
    expect(energySignal([3, 3])).toBe("MIXED");
    expect(energySignal([4, 3])).toBe("STEADY");
  });

  it.each([
    ["2026-07-13T01:59:00.000Z", "NIGHT"],
    ["2026-07-13T02:00:00.000Z", "MORNING"],
    ["2026-07-13T08:59:00.000Z", "MORNING"],
    ["2026-07-13T09:00:00.000Z", "AFTERNOON"],
    ["2026-07-13T13:59:00.000Z", "AFTERNOON"],
    ["2026-07-13T14:00:00.000Z", "EVENING"],
    ["2026-07-13T18:59:00.000Z", "EVENING"],
    ["2026-07-13T19:00:00.000Z", "NIGHT"],
  ])("maps %s to the Istanbul %s focus band", (timestamp, expected) => {
    expect(istanbulFocusTimeBand(new Date(timestamp))).toBe(expected);
  });

  it("selects the time band with the most focus and uses day order for ties", () => {
    expect(
      selectWeeklyFocusTimeBand([
        {
          startedAt: new Date("2026-07-13T06:00:00.000Z"),
          actualFocusSeconds: 600,
        },
        {
          startedAt: new Date("2026-07-14T10:00:00.000Z"),
          actualFocusSeconds: 1_200,
        },
        {
          startedAt: new Date("2026-07-15T15:00:00.000Z"),
          actualFocusSeconds: 1_200,
        },
      ]),
    ).toEqual({
      id: "AFTERNOON",
      focusMinutes: 20,
      qualifyingSessionCount: 1,
    });
    expect(selectWeeklyFocusTimeBand([])).toBeNull();
  });

  it("keeps the earlier Istanbul date when peak focus days tie", () => {
    expect(
      weeklyPeakFocusDay([
        {
          endedAt: new Date("2026-07-13T08:00:00.000Z"),
          actualFocusSeconds: 1_500,
        },
        {
          endedAt: new Date("2026-07-14T08:00:00.000Z"),
          actualFocusSeconds: 1_500,
        },
      ]),
    ).toEqual({ date: "2026-07-13", focusMinutes: 25 });
    expect(weeklyPeakFocusDay([])).toBeNull();
  });

  it("prioritizes repeated photos, normalized decline, lowest score, then session rhythm", () => {
    const subjects = [
      {
        subjectRef: "short",
        subjectName: "Short",
        questionCount: 6,
        currentAverageNet: 4,
        previousAverageNet: 5,
      },
      {
        subjectRef: "long",
        subjectName: "Long",
        questionCount: 30,
        currentAverageNet: 12,
        previousAverageNet: 18,
      },
    ];
    expect(
      selectWeeklyFocus(subjects, [{ subjectRef: "short", count: 2 }], true),
    ).toMatchObject({ source: "REPEATED_PHOTO_SIGNAL", subjectRef: "short" });
    expect(selectWeeklyFocus(subjects, [], true)).toMatchObject({
      source: "WEEKLY_DECLINE",
      subjectRef: "long",
    });
    expect(
      selectWeeklyFocus(
        subjects.map((subject) => ({ ...subject, previousAverageNet: null })),
        [],
        true,
      ),
    ).toMatchObject({ source: "LOWEST_NORMALIZED", subjectRef: "long" });
    expect(selectWeeklyFocus([], [], false)).toEqual({
      source: "SESSION_RHYTHM",
      subjectRef: null,
      subjectName: null,
    });
  });
});
