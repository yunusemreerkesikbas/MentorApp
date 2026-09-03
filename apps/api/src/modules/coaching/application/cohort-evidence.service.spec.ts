import { describe, expect, it } from "vitest";
import { CohortEvidenceService } from "./cohort-evidence.service";

const NOW = new Date("2026-09-10T09:00:00.000Z");
const STUDENT = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const MY_LINK = "33333333-3333-4333-8333-333333333333";
const OTHER_LINK = "44444444-4444-4444-8444-444444444444";

/** Captures what the service forwarded to the repository, so the scoping arg can be asserted. */
let lastPlanTaskLinkId: string | undefined;

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

function repoFake() {
  return {
    sessionTotalsSince: async (ids: string[], since: Date) => [
      {
        userId: ids[0]!,
        sessions: since < new Date("2026-08-20") ? 20 : 5,
        focusMinutes: since < new Date("2026-08-20") ? 900 : 240,
        struggleNote: LEAK,
        aiReflection: LEAK,
        sessionMood: 1,
      },
    ],
    activityWindow: async (ids: string[], sinceDate: string) => [
      {
        userId: ids[0]!,
        lastActiveDate: "2026-09-09",
        activeDays: sinceDate < "2026-08-20" ? 18 : 4,
      },
    ],
    streaks: async (ids: string[]) => [
      { userId: ids[0]!, currentStreak: 4, longestStreak: 11 },
    ],
    planTotalsSince: async (ids: string[]) => [{ userId: ids[0]!, total: 10, done: 3 }],
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
        takenAt: new Date("2026-09-08T12:00:00.000Z"),
        totalNet: "58.50",
        publisherName: "Limit",
        aiGhostNarration: LEAK,
      },
    ],
    mockSubjects: async () => [
      { subjectRef: "matematik", correct: 20, wrong: 8, blank: 2, net: "18.00" },
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

const service = () => new CohortEvidenceService(repoFake() as never);

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

    it("returns nothing for an empty cohort without touching the database", async () => {
      await expect(service().listCohortSnapshots([], NOW)).resolves.toEqual(new Map());
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
