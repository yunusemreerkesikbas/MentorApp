import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type {
  MentorshipCoachOverviewDto,
  MentorshipCoachRegistrationStateDto,
  MentorshipRosterRowDto,
  MentorshipSharedDataDto,
  MentorshipWeeklyReportShareDto,
} from "@mentor/types";
import {
  buildCoachRoundBuckets,
  buildTemplateDrafts,
  computeSeatCardState,
  formatScopeValue,
  formatWeeklyReportShareText,
  parseInviteCodeFromInput,
  toTemplateTasks,
} from "./mentorship-view.ts";

function makeOverview(
  overrides: Partial<MentorshipCoachOverviewDto> = {},
): MentorshipCoachOverviewDto {
  return {
    inviteCode: { code: "MENTOR-KOC-AABBCCDDEEFF", expiresAt: "2026-12-01T00:00:00Z" },
    activeStudents: 1,
    maxActiveStudents: 30,
    freeSeats: 2,
    paidSeats: 0,
    usedSeats: 1,
    waitingStudents: 0,
    sponsorshipEnabled: false,
    seatAllowance: 2,
    seatPlansOnSale: false,
    dataScope: ["ACTIVITY", "MOCK_EXAMS"],
    ...overrides,
  };
}

function makeRegState(
  overrides: Partial<MentorshipCoachRegistrationStateDto> = {},
): MentorshipCoachRegistrationStateDto {
  return {
    registrationOpen: true,
    registration: null,
    emailVerified: true,
    phoneVerified: true,
    inviteBlockedReason: null,
    hasCoach: false,
    ...overrides,
  };
}

function makeRosterRow(
  overrides: Partial<MentorshipRosterRowDto> = {},
): MentorshipRosterRowDto {
  return {
    linkId: "l1",
    studentId: "s1",
    studentDisplayName: "Deniz",
    studentUsername: "deniz",
    avatarUrl: null,
    status: "ACTIVE",
    acceptedAt: "2026-11-01T10:00:00Z",
    endedAt: null,
    seat: "FREE",
    metrics: null,
    riskFlags: [],
    attendedAt: null,
    needsAttention: false,
    ...overrides,
  };
}

describe("mentorship-view helpers", () => {
  it("computes seat card states for open, full, closed, and standing locks", () => {
    assert.deepEqual(computeSeatCardState(null, null), { kind: "loading" });
    assert.deepEqual(
      computeSeatCardState(makeOverview({ seatAllowance: 0 }), makeRegState()),
      { kind: "closed" },
    );
    assert.deepEqual(
      computeSeatCardState(makeOverview({ usedSeats: 2, seatAllowance: 2 }), makeRegState()),
      {
        kind: "full",
        used: 2,
        total: 2,
        reason: "seats",
        limit: 30,
        plansOnSale: false,
        sponsored: false,
        waiting: 0,
      },
    );
    assert.deepEqual(
      computeSeatCardState(
        makeOverview({ inviteCode: null }),
        makeRegState({ inviteBlockedReason: "NOT_ACTIVE" }),
      ),
      { kind: "locked", lock: "STANDING" },
    );
    assert.equal(computeSeatCardState(makeOverview(), makeRegState()).kind, "open");
  });

  it("formats live shared-data mirror scope lines without leaking AI_BRIEF as numeric", () => {
    const shared: MentorshipSharedDataDto = {
      activity: {
        windowDays: 7,
        sessions7d: 5,
        focusMinutes7d: 210,
        activeDays7d: 4,
        currentStreak: 3,
        longestStreak: 6,
        lastActiveDate: "2026-11-21",
      },
      planTasks: {
        titleWindowDays: 14,
        titleCount: 8,
        planCompletionRate7d: 0.75,
      },
      mood: { windowDays: 7, count: 4, average: 3.5 },
      mockExams: { count: 2, latestAt: "2026-11-20T12:00:00.000Z" },
      examType: "KPSS",
    };
    const labels = {
      activityValue: ({ minutes, sessions }: { minutes: number; sessions: number }) =>
        `${sessions} seans · ${minutes} dk`,
      mockExamsValue: ({ count }: { count: number }) => `${count} deneme`,
      planTitlesValue: ({ count }: { count: number }) => `${count} görev`,
      planRateValue: ({ percent }: { percent: number }) => `%${percent}`,
      moodValue: ({ average }: { average: string }) => `${average}/5`,
    };
    assert.equal(formatScopeValue("ACTIVITY", shared, labels, "tr"), "5 seans · 210 dk");
    assert.equal(formatScopeValue("MOCK_EXAMS", shared, labels, "tr"), "2 deneme");
    assert.equal(formatScopeValue("PLAN_TASK_TITLES", shared, labels, "tr"), "8 görev %75");
    assert.equal(formatScopeValue("MOOD_LEVEL", shared, labels, "tr"), "3,5/5");
    assert.equal(formatScopeValue("EXAM_TRACK", shared, labels, "tr"), "KPSS");
    assert.equal(formatScopeValue("AI_BRIEF", shared, labels, "tr"), null);
  });

  it("buckets active roster rows into attention, waitingSeat, and steady", () => {
    const buckets = buildCoachRoundBuckets([
      makeRosterRow({ studentId: "a", needsAttention: true }),
      makeRosterRow({ studentId: "w", seat: "NONE", needsAttention: true }),
      makeRosterRow({ studentId: "s", needsAttention: false }),
    ]);
    assert.deepEqual(buckets.needsAttention.map((r) => r.studentId), ["a"]);
    assert.deepEqual(buckets.waitingSeat.map((r) => r.studentId), ["w"]);
    assert.deepEqual(buckets.steady.map((r) => r.studentId), ["s"]);
  });

  it("normalizes templates and drops cross-exam topics cleanly", () => {
    const normalized = toTemplateTasks([
      { taskDate: "2026-11-25", title: "B", subject: "Tarih", topic: "Osmanli", coachNote: null },
      { taskDate: "2026-11-23", title: "A", subject: "Matematik", topic: "Temel", coachNote: "hiz" },
    ]);
    assert.deepEqual(
      normalized.map((t) => [t.title, t.dayIndex]),
      [["A", 0], ["B", 2]],
    );

    const loaded = buildTemplateDrafts(
      { examType: "KPSS", tasks: normalized },
      "2026-12-01",
      "YKS",
      5,
    );
    assert.equal(loaded.clearedTopics, 2);
    assert.equal(loaded.drafts[0]?.topic, null);
    assert.equal(loaded.drafts[1]?.taskDate, "2026-12-03");
  });

  it("formats student share text without leaking brief fields and extracts pasted invite codes", () => {
    const share: MentorshipWeeklyReportShareDto = {
      id: "r1",
      locale: "tr",
      studentDisplayName: "Deniz",
      coachDisplayName: "Koç Ayşe",
      period: {
        startDate: "2026-11-16",
        endDate: "2026-11-22",
        previousStartDate: "2026-11-09",
        previousEndDate: "2026-11-15",
        timeZone: "Europe/Istanbul",
      },
      version: 1,
      finalizedAt: "2026-11-22T12:00:00Z",
      snapshot: {
        period: {
          startDate: "2026-11-16",
          endDate: "2026-11-22",
          previousStartDate: "2026-11-09",
          previousEndDate: "2026-11-15",
          timeZone: "Europe/Istanbul",
        },
        current: {
          focusMinutes: 180,
          sessions: 4,
          activeDays: 3,
          plannedTasks: 5,
          completedTasks: 4,
          completionRate: 0.8,
          hasRecordedActivity: true,
        },
        previous: {
          focusMinutes: 120,
          sessions: 3,
          activeDays: 2,
          plannedTasks: 4,
          completedTasks: 2,
          completionRate: 0.5,
          hasRecordedActivity: true,
        },
        deltas: {
          focusMinutes: 60,
          sessions: 1,
          activeDays: 1,
          plannedTasks: 1,
          completedTasks: 2,
          completionRate: 0.3,
        },
        subjects: [],
        mocks: {
          examScopeName: "KPSS",
          currentAttemptCount: 1,
          previousAttemptCount: 0,
          currentAverageNet: 65,
          previousAverageNet: null,
          currentPublishers: [],
          previousPublishers: [],
          subjects: [],
        },
        limitations: [],
      },
      subjectNames: {},
      coachEvaluation: "İyi tempo.",
    };
    const text = formatWeeklyReportShareText(
      share,
      {
        header: ({ student, coach, period }) => `${student} · ${coach} (${period})`,
        focusLine: ({ current, previous }) => `Odak: ${current} dk (önceki ${previous} dk)`,
        activeDaysLine: ({ current }) => `Aktif gün: ${current}`,
        tasksLine: ({ done, planned }) => `Görev: ${done}/${planned}`,
        mockLine: ({ current }) => `Net: ${current}`,
        evaluationHeading: "Koç değerlendirmesi",
      },
      "tr",
    );
    assert.ok(text.includes("Koç Ayşe"));
    assert.ok(text.includes("İyi tempo."));
    assert.equal(
      parseInviteCodeFromInput("https://puhukoc.com/davet/mentor-koc-a1b2c3d4e5f6"),
      "MENTOR-KOC-A1B2C3D4E5F6",
    );
  });
});
