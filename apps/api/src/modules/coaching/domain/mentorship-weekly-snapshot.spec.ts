import { describe, expect, it } from "vitest";
import { buildMentorshipWeeklySnapshot } from "./mentorship-weekly-snapshot";

describe("buildMentorshipWeeklySnapshot", () => {
  it("compares completed weeks and keeps unmatched subjects explicit", () => {
    const snapshot = buildMentorshipWeeklySnapshot(
      {
        startDate: "2026-08-31",
        endDate: "2026-09-06",
        previousStartDate: "2026-08-24",
        previousEndDate: "2026-08-30",
        timeZone: "Europe/Istanbul",
      },
      {
        sessions: [
          {
            endedAt: new Date("2026-09-01T21:30:00.000Z"),
            focusSeconds: 1800,
            subject: "math",
          },
          {
            endedAt: new Date("2026-09-03T09:00:00.000Z"),
            focusSeconds: 900,
            subject: null,
          },
          {
            endedAt: new Date("2026-08-25T09:00:00.000Z"),
            focusSeconds: 1200,
            subject: "math",
          },
        ],
        tasks: [
          { taskDate: "2026-09-02", status: "DONE" },
          { taskDate: "2026-09-03", status: "PENDING" },
          { taskDate: "2026-08-26", status: "DONE" },
        ],
        mocks: [
          {
            examId: "exam-kpss",
            examName: "KPSS Lisans",
            takenAt: new Date("2026-09-05T09:00:00.000Z"),
            totalNet: 70,
            publisherName: "A",
            subjects: [{ subjectRef: "math", net: 20 }],
          },
          {
            examId: "exam-kpss",
            examName: "KPSS Lisans",
            takenAt: new Date("2026-08-29T09:00:00.000Z"),
            totalNet: 60,
            publisherName: "B",
            subjects: [{ subjectRef: "math", net: 15 }],
          },
        ],
      },
    );

    expect(snapshot.current).toMatchObject({
      focusMinutes: 45,
      sessions: 2,
      activeDays: 3,
      plannedTasks: 2,
      completedTasks: 1,
      completionRate: 0.5,
      hasRecordedActivity: true,
    });
    expect(snapshot.previous).toMatchObject({
      focusMinutes: 20,
      activeDays: 3,
    });
    expect(snapshot.subjects).toEqual([
      {
        subjectRef: "math",
        currentFocusMinutes: 30,
        currentSessions: 1,
        previousFocusMinutes: 20,
        previousSessions: 1,
      },
      {
        subjectRef: null,
        currentFocusMinutes: 15,
        currentSessions: 1,
        previousFocusMinutes: 0,
        previousSessions: 0,
      },
    ]);
    expect(snapshot.mocks).toMatchObject({
      examScopeName: "KPSS Lisans",
      currentAttemptCount: 1,
      previousAttemptCount: 1,
      currentAverageNet: 70,
      previousAverageNet: 60,
    });
    expect(snapshot.limitations).toContain("UNCLASSIFIED_SESSIONS");
    expect(snapshot.limitations).toContain("MOCK_PUBLISHERS_DIFFER");
    expect(snapshot.limitations).toContain("LIMITED_MOCK_ATTEMPTS");
    expect(snapshot.evidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "subject_focus:math",
          subjectRef: "math",
          current: 30,
          previous: 20,
          delta: 10,
        }),
        expect.objectContaining({
          id: "subject_mock:math",
          current: 20,
          previous: 15,
          currentAttemptCount: 1,
          previousAttemptCount: 1,
        }),
      ]),
    );
    expect(
      snapshot.evidence.some((item) => item.id === "subject_focus:null"),
    ).toBe(false);
    expect(
      snapshot.evidence.find((item) => item.id === "mock_average"),
    ).toEqual({
      id: "mock_average",
      kind: "MOCK_AVERAGE",
      current: 70,
      previous: 60,
      delta: 10,
    });
  });

  it("never mixes attempts from different exam scopes", () => {
    const period = {
      startDate: "2026-08-31",
      endDate: "2026-09-06",
      previousStartDate: "2026-08-24",
      previousEndDate: "2026-08-30",
      timeZone: "Europe/Istanbul" as const,
    };
    const snapshot = buildMentorshipWeeklySnapshot(period, {
      sessions: [],
      tasks: [],
      mocks: [
        {
          examId: "tyt",
          examName: "TYT",
          takenAt: new Date("2026-09-05T09:00:00.000Z"),
          totalNet: 80,
          publisherName: "A",
          subjects: [],
        },
        {
          examId: "ayt",
          examName: "AYT",
          takenAt: new Date("2026-09-04T09:00:00.000Z"),
          totalNet: 120,
          publisherName: "B",
          subjects: [],
        },
        {
          examId: "tyt",
          examName: "TYT",
          takenAt: new Date("2026-08-29T09:00:00.000Z"),
          totalNet: 70,
          publisherName: "C",
          subjects: [],
        },
      ],
    });

    expect(snapshot.mocks).toMatchObject({
      examScopeName: "TYT",
      currentAttemptCount: 1,
      previousAttemptCount: 1,
      currentAverageNet: 80,
      previousAverageNet: 70,
    });
    expect(snapshot.limitations).toContain("MIXED_MOCK_SCOPE");
  });

  it("reports missing data without turning it into zero performance", () => {
    const snapshot = buildMentorshipWeeklySnapshot(
      {
        startDate: "2026-08-31",
        endDate: "2026-09-06",
        previousStartDate: "2026-08-24",
        previousEndDate: "2026-08-30",
        timeZone: "Europe/Istanbul",
      },
      { sessions: [], tasks: [], mocks: [] },
    );

    expect(snapshot.current.completionRate).toBeNull();
    expect(snapshot.mocks.currentAverageNet).toBeNull();
    expect(snapshot.limitations).toEqual([
      "NO_CURRENT_ACTIVITY",
      "NO_PREVIOUS_ACTIVITY",
      "NO_CURRENT_MOCK",
      "NO_PREVIOUS_MOCK",
    ]);
  });

  it("builds the same snapshot when database rows arrive in another order", () => {
    const period = {
      startDate: "2026-08-31",
      endDate: "2026-09-06",
      previousStartDate: "2026-08-24",
      previousEndDate: "2026-08-30",
      timeZone: "Europe/Istanbul" as const,
    };
    const mocks = [
      {
        examId: "exam-a",
        examName: "KPSS A",
        takenAt: new Date("2026-09-05T09:00:00.000Z"),
        totalNet: 70,
        publisherName: "Z Yayınları",
        subjects: [],
      },
      {
        examId: "exam-b",
        examName: "KPSS B",
        takenAt: new Date("2026-09-05T09:00:00.000Z"),
        totalNet: 80,
        publisherName: "B Yayınları",
        subjects: [],
      },
      {
        examId: "exam-a",
        examName: "KPSS A",
        takenAt: new Date("2026-09-04T09:00:00.000Z"),
        totalNet: 65,
        publisherName: "A Yayınları",
        subjects: [],
      },
    ];

    const first = buildMentorshipWeeklySnapshot(period, {
      sessions: [],
      tasks: [],
      mocks,
    });
    const reversed = buildMentorshipWeeklySnapshot(period, {
      sessions: [],
      tasks: [],
      mocks: [...mocks].reverse(),
    });

    expect(reversed).toEqual(first);
    expect(first.mocks.currentPublishers).toEqual([
      "A Yayınları",
      "Z Yayınları",
    ]);
  });
});
