import { describe, expect, it } from "vitest";
import { STREAK_LOOKBACK_DAYS } from "../domain/coaching.constants";
import { addDays } from "../domain/date.util";
import { CohortEvidenceService } from "./cohort-evidence.service";

const NOW = new Date("2026-09-10T09:00:00.000Z");
const STUDENT = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const MY_LINK = "33333333-3333-4333-8333-333333333333";
const OTHER_LINK = "44444444-4444-4444-8444-444444444444";
const EXAM = "55555555-5555-4555-8555-555555555555";
const RETIRED_EXAM = "66666666-6666-4666-8666-666666666666";

/** Captures what the service forwarded to the repository, so the scoping arg can be asserted. */
let lastPlanTaskLinkId: string | undefined;
let lastPlanWindow: [string, string] | undefined;
let dailySinceCalls: string[] = [];

/**
 * Sentinel values shaped like the free-text columns that live next to the ones we DO read.
 * If a `select *` or a `...row` spread ever creeps in, one of these surfaces in the output and
 * the assertion at the bottom of this file fails. That is the whole point of the file.
 */
const LEAK = "__LEAK__";
const FORBIDDEN_KEYS = [
  "struggleNote",
  "aiReflection",
  "sessionMood",
  "description",
  "email",
  "bio",
  "passwordHash",
  "aiGhostNarration",
];

const activeOn = (ids: string[], ...dates: string[]) =>
  dates.map((date) => ({ userId: ids[0]!, date }));

function repoFake() {
  return {
    sessionTotalsSince: async (ids: string[], sinceDate: string) => [
      {
        userId: ids[0]!,
        sessions: sinceDate < "2026-08-20" ? 20 : 5,
        focusMinutes: sinceDate < "2026-08-20" ? 900 : 240,
        struggleNote: LEAK,
        aiReflection: LEAK,
        sessionMood: 1,
      },
    ],
    dailyFocusMinutes: async (ids: string[], sinceDate: string) => {
      dailySinceCalls.push(sinceDate);
      return [
        { userId: ids[0]!, day: "2026-08-28", focusMinutes: 20 },
        { userId: ids[0]!, day: "2026-09-05", focusMinutes: 90 },
        { userId: ids[0]!, day: "2026-09-10", focusMinutes: 45 },
      ];
    },
    activityWindow: async (ids: string[], sinceDate: string) => [
      {
        userId: ids[0]!,
        lastActiveDate: "2026-09-09",
        activeDays: sinceDate < "2026-08-20" ? 18 : 4,
      },
    ],
    // `streak_state` is a cache the STUDENT's own reads refresh. A coach reading a student who has
    // not opened the app since is reading a stale row, which is why it says 9 here while the
    // activity below says 4.
    streaks: async (ids: string[]) => [
      { userId: ids[0]!, currentStreak: 9, longestStreak: 11 },
    ],
    activeDatesSince: async (ids: string[]) =>
      activeOn(ids, "2026-09-06", "2026-09-07", "2026-09-08", "2026-09-09"),
    purchasedFreezeDatesSince: async (): Promise<{ userId: string; date: string }[]> => [],
    planTotalsSince: async (ids: string[], sinceDate: string, untilDate: string) => {
      lastPlanWindow = [sinceDate, untilDate];
      return [{ userId: ids[0]!, total: 10, done: 3 }];
    },
    latestMocks: async (ids: string[]) => [
      {
        userId: ids[0]!,
        totalNet: "58.50",
        takenAt: new Date("2026-09-08T12:00:00.000Z"),
        previousNetAvg: "63.00",
        aiGhostNarration: LEAK,
      },
    ],
    moodAverageSince: async (ids: string[]) => [{ userId: ids[0]!, average: 2.5 }],
    mockTrend: async () => [
      {
        id: "mock-1",
        examId: EXAM,
        takenAt: new Date("2026-09-08T12:00:00.000Z"),
        totalNet: "58.50",
        publisherName: "Limit",
        aiGhostNarration: LEAK,
      },
      {
        id: "mock-0",
        examId: RETIRED_EXAM,
        takenAt: new Date("2026-08-30T12:00:00.000Z"),
        totalNet: "61.00",
        publisherName: null,
      },
    ],
    mockSubjects: async () => [
      { subjectRef: "matematik", correct: 20, wrong: 8, blank: 2, net: "18.00" },
      { subjectRef: "eski-ders", correct: 5, wrong: 1, blank: 0, net: "4.75" },
    ],
    // Mirrors the SQL projection: `assignedByCoach`/`coachNote` are already resolved against the
    // caller's link id by the time they reach the service, so a row the CALLER did not author
    // arrives with both blanked out. `description` rides along as the sentinel.
    planTaskRows: async (
      _studentId: string,
      _sinceDate: string,
      _limit: number,
      mentorshipLinkId?: string,
    ) => {
      lastPlanTaskLinkId = mentorshipLinkId;
      return [
        {
          taskDate: "2026-09-09",
          title: "Paragraf 20 soru",
          subject: "Türkçe",
          topic: "Paragrafta anlam",
          status: "DONE",
          assignedByCoach: mentorshipLinkId === MY_LINK,
          coachNote: mentorshipLinkId === MY_LINK ? "Süreni tut" : null,
          description: LEAK,
        },
      ];
    },
    moodTrend: async () => [{ date: "2026-09-09", level: 2, struggleNote: LEAK }],
  };
}

/** Content knows one exam; `RETIRED_EXAM` stands for an attempt whose exam has since gone. */
function contentFake() {
  return {
    getExamById: async (id: string) =>
      id === EXAM
        ? { id, slug: "kpss-lisans", name: "KPSS Lisans", netRule: { kind: "WRONG_PENALTY", divisor: 4 } }
        : null,
    listExamSubjects: async (id: string) =>
      id === EXAM
        ? [{ slug: "matematik", name: "Matematik", questionCount: 30, sortOrder: 1 }]
        : [],
  };
}

const MIN_FOCUS_SECONDS = 300;
const configFake = () => ({ get: async () => MIN_FOCUS_SECONDS });

const service = (repo: object = repoFake()) =>
  new CohortEvidenceService(repo as never, contentFake() as never, configFake() as never);

/** Wraps every repository read so a test can assert the window bounds it was asked for. */
function recording(repo: object = repoFake()) {
  const calls: Record<string, unknown[][]> = {};
  const wrapped = Object.fromEntries(
    Object.entries(repo).map(([name, read]) => [
      name,
      (...args: unknown[]) => {
        (calls[name] ??= []).push(args);
        return (read as (...a: unknown[]) => unknown)(...args);
      },
    ]),
  );
  return { calls, service: service(wrapped) };
}

/** 22:30 UTC on the 10th is 01:30 on the 11th in Istanbul: the two calendars disagree on "today". */
const LATE = new Date("2026-09-10T22:30:00.000Z");
describe("CohortEvidenceService", () => {
  describe("listCohortSnapshots", () => {
    it("returns a row for every requested student, even one with no data", async () => {
      const snapshots = await service().listCohortSnapshots([STUDENT, OTHER], NOW);
      expect(snapshots.size).toBe(2);
      // The fake only answers for the first id — the second must still get an all-zero row,
      // because "this student has done nothing" is the most important thing a coach can see.
      expect(snapshots.get(OTHER)).toMatchObject({
        studentId: OTHER,
        lastActiveDate: null,
        currentStreak: 0,
        sessions7d: 0,
        focusMinutes7d: 0,
        planCompletionRate7d: null,
        latestMockNet: null,
        moodLevel7dAvg: null,
        dailyFocusMinutes14d: Array(14).fill(0),
      });
    });

    it("maps the aggregates a coach acts on", async () => {
      const snapshot = (await service().listCohortSnapshots([STUDENT], NOW)).get(STUDENT)!;
      expect(snapshot).toMatchObject({
        lastActiveDate: "2026-09-09",
        currentStreak: 4,
        sessions7d: 5,
        focusMinutes7d: 240,
        activeDays7d: 4,
        planCompletionRate7d: 0.3,
        latestMockNet: 58.5,
        previousMockNetAvg: 63,
        moodLevel7dAvg: 2.5,
      });
    });

    it("draws the last 14 Istanbul days oldest first, with an empty day as 0", async () => {
      dailySinceCalls = [];
      const snapshot = (await service().listCohortSnapshots([STUDENT], NOW)).get(STUDENT)!;
      expect(dailySinceCalls).toEqual(["2026-08-28"]);
      expect(snapshot.dailyFocusMinutes14d).toEqual([
        20, 0, 0, 0, 0, 0, 0, 0, 90, 0, 0, 0, 0, 45,
      ]);
    });

    it("ends the strip on the Istanbul day after UTC midnight has not yet come", async () => {
      // 22:30 UTC is 01:30 the next day in Istanbul: a session the student just finished belongs
      // to the new day's cell, not to yesterday's.
      dailySinceCalls = [];
      const repo = {
        ...repoFake(),
        dailyFocusMinutes: async (ids: string[], sinceDate: string) => {
          dailySinceCalls.push(sinceDate);
          return [{ userId: ids[0]!, day: "2026-09-11", focusMinutes: 30 }];
        },
      };
      const late = new Date("2026-09-10T22:30:00.000Z");
      const snapshot = (await service(repo).listCohortSnapshots([STUDENT], late)).get(STUDENT)!;
      expect(dailySinceCalls).toEqual(["2026-08-29"]);
      expect(snapshot.dailyFocusMinutes14d.at(-1)).toBe(30);
    });

    it("derives the streak from activity rather than the cached streak_state", async () => {
      const snapshot = (await service().listCohortSnapshots([STUDENT], NOW)).get(STUDENT)!;
      expect(snapshot.currentStreak).toBe(4);
    });

    it("bridges a coin-purchased freeze day the way the student's own streak does", async () => {
      const repo = {
        ...repoFake(),
        activeDatesSince: async (ids: string[]) => activeOn(ids, "2026-09-06", "2026-09-09"),
        purchasedFreezeDatesSince: async (ids: string[]) => activeOn(ids, "2026-09-08"),
      };
      const snapshot = (await service(repo).listCohortSnapshots([STUDENT], NOW)).get(STUDENT)!;
      // Without the purchased day the walk stops at 09-08 (two missed days in a row) → 1.
      expect(snapshot.currentStreak).toBe(2);
    });

    it("rates the plan only up to today, so an assigned future week cannot drag it down", async () => {
      lastPlanWindow = undefined;
      await service().listCohortSnapshots([STUDENT], NOW);
      expect(lastPlanWindow).toEqual(["2026-09-04", "2026-09-10"]);
    });

    it("returns nothing for an empty cohort without touching the database", async () => {
      await expect(service().listCohortSnapshots([], NOW)).resolves.toEqual(new Map());
    });
  });

  describe("listTriageSnapshots", () => {
    it("reads what the risk rules need, and neither the strip nor the 400-day streak", async () => {
      // The digest snapshots every linked student each morning; the roster's drawing is not its to pay for.
      const { calls, service: svc } = recording();
      const snapshot = (await svc.listTriageSnapshots([STUDENT], NOW)).get(STUDENT)!;
      expect(snapshot).toMatchObject({
        lastActiveDate: "2026-09-09",
        planCompletionRate7d: 0.3,
        latestMockNet: 58.5,
        previousMockNetAvg: 63,
        moodLevel7dAvg: 2.5,
      });
      expect(snapshot).not.toHaveProperty("currentStreak");
      expect(snapshot).not.toHaveProperty("dailyFocusMinutes14d");
      expect(Object.keys(calls)).not.toContain("dailyFocusMinutes");
      expect(Object.keys(calls)).not.toContain("activeDatesSince");
      expect(Object.keys(calls)).not.toContain("purchasedFreezeDatesSince");
    });
  });

  describe("getStudentReport", () => {
    it("carries task titles but not the note behind them", async () => {
      const report = await service().getStudentReport(STUDENT, NOW);
      expect(report.planTasks).toEqual([
        {
          taskDate: "2026-09-09",
          title: "Paragraf 20 soru",
          subject: "Türkçe",
          topic: "Paragrafta anlam",
          status: "DONE",
          assignedByCoach: false,
          coachNote: null,
        },
      ]);
    });

    it("forwards the caller's link id so the coach-authored fields can be scoped", async () => {
      lastPlanTaskLinkId = undefined;
      await service().getStudentReport(STUDENT, NOW, MY_LINK);
      expect(lastPlanTaskLinkId).toBe(MY_LINK);
    });

    it("reads back the note the CALLING coach wrote", async () => {
      const report = await service().getStudentReport(STUDENT, NOW, MY_LINK);
      expect(report.planTasks[0]).toMatchObject({
        assignedByCoach: true,
        coachNote: "Süreni tut",
      });
    });

    it("hides a note left by a different coach's link", async () => {
      // The projection is link-scoped, not "is this a MENTORSHIP row": a task assigned by the
      // previous coach outlives their link, and its note is not the successor's to read.
      const report = await service().getStudentReport(STUDENT, NOW, OTHER_LINK);
      expect(report.planTasks[0]).toMatchObject({
        assignedByCoach: false,
        coachNote: null,
      });
    });

    it("carries the mood level but not what the student wrote next to it", async () => {
      const report = await service().getStudentReport(STUDENT, NOW);
      expect(report.moodTrend).toEqual([{ date: "2026-09-09", level: 2 }]);
    });

    it("separates the 7-day and 28-day activity windows", async () => {
      const report = await service().getStudentReport(STUDENT, NOW);
      expect(report.activity).toMatchObject({
        sessions7d: 5,
        focusMinutes7d: 240,
        sessions28d: 20,
        focusMinutes28d: 900,
        currentStreak: 4,
        longestStreak: 11,
      });
    });

    it("draws the last 28 Istanbul days oldest first", async () => {
      dailySinceCalls = [];
      const report = await service().getStudentReport(STUDENT, NOW);
      expect(dailySinceCalls).toContain("2026-08-14");
      expect(report.dailyFocusMinutes28d).toHaveLength(28);
      expect(report.dailyFocusMinutes28d[14]).toBe(20);
      expect(report.dailyFocusMinutes28d[22]).toBe(90);
      expect(report.dailyFocusMinutes28d[27]).toBe(45);
      expect(report.dailyFocusMinutes28d.reduce((sum, value) => sum + value, 0)).toBe(155);
    });

    it("never reports a longest streak shorter than the current one", async () => {
      const repo = {
        ...repoFake(),
        streaks: async (ids: string[]) => [
          { userId: ids[0]!, currentStreak: 0, longestStreak: 2 },
        ],
      };
      const report = await service(repo).getStudentReport(STUDENT, NOW);
      expect(report.activity).toMatchObject({ currentStreak: 4, longestStreak: 4 });
    });

    it("rates the plan only up to today", async () => {
      lastPlanWindow = undefined;
      await service().getStudentReport(STUDENT, NOW);
      expect(lastPlanWindow).toEqual(["2026-09-04", "2026-09-10"]);
    });

    it("names each attempt's exam, and says nothing when the exam is unknown", async () => {
      const report = await service().getStudentReport(STUDENT, NOW);
      expect(report.mockTrend.map((mock) => mock.examName)).toEqual(["KPSS Lisans", null]);
    });

    it("names the latest attempt's subjects, falling back to the slug", async () => {
      const report = await service().getStudentReport(STUDENT, NOW);
      expect(
        report.latestMockSubjects.map(({ subjectRef, subjectName }) => ({ subjectRef, subjectName })),
      ).toEqual([
        { subjectRef: "matematik", subjectName: "Matematik" },
        { subjectRef: "eski-ders", subjectName: "eski-ders" },
      ]);
    });
  });

  /**
   * One calendar for every coach window: the Istanbul day the weekly report, follow-ups and the
   * plan already use. The streak alone stays on the student's own UTC day, so both see one number.
   */
  describe("day boundaries", () => {
    it("cuts the roster's 7-day windows on the Istanbul day", async () => {
      const { calls, service: svc } = recording();
      await svc.listCohortSnapshots([STUDENT], LATE);
      expect(calls.sessionTotalsSince).toEqual([[[STUDENT], "2026-09-05"]]);
      expect(calls.activityWindow).toEqual([[[STUDENT], "2026-09-05", MIN_FOCUS_SECONDS]]);
      expect(calls.planTotalsSince).toEqual([[[STUDENT], "2026-09-05", "2026-09-11"]]);
      expect(calls.moodAverageSince?.[0]?.[1]).toBe("2026-09-05");
      expect(calls.activeDatesSince?.[0]?.[1]).toBe(addDays("2026-09-10", -STREAK_LOOKBACK_DAYS));
    });

    it("cuts the report's 7/28-day, plan and mood windows on the Istanbul day", async () => {
      const { calls, service: svc } = recording();
      await svc.getStudentReport(STUDENT, LATE);
      expect(calls.sessionTotalsSince).toEqual([
        [[STUDENT], "2026-09-05"],
        [[STUDENT], "2026-08-15"],
      ]);
      expect(calls.activityWindow).toEqual([
        [[STUDENT], "2026-09-05", MIN_FOCUS_SECONDS],
        [[STUDENT], "2026-08-15", MIN_FOCUS_SECONDS],
      ]);
      expect(calls.planTotalsSince).toEqual([[[STUDENT], "2026-09-05", "2026-09-11"]]);
      expect(calls.planTaskRows?.[0]?.[1]).toBe("2026-08-29");
      expect(calls.moodTrend?.[0]?.[1]).toBe("2026-08-29");
      expect(calls.activeDatesSince?.[0]?.[1]).toBe(addDays("2026-09-10", -STREAK_LOOKBACK_DAYS));
    });
  });

  /**
   * The trust line (guardrail §4 #5), enforced rather than documented. Every repository row above
   * carries the free-text columns that sit beside the ones we read; none of them may come out.
   */
  it("never lets a student's free text reach the coach surface", async () => {
    const svc = service();
    const roster = JSON.stringify([...(await svc.listCohortSnapshots([STUDENT], NOW))]);
    const report = JSON.stringify(await svc.getStudentReport(STUDENT, NOW));
    for (const payload of [roster, report]) {
      expect(payload).not.toContain(LEAK);
      for (const key of FORBIDDEN_KEYS) {
        expect(payload).not.toContain(key);
      }
    }
  });
});
