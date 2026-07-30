import { describe, expect, it, vi } from "vitest";
import { WeeklyReviewService } from "./weekly-review.service";

const fakeDb = {
  transaction: async <T>(cb: (tx: unknown) => Promise<T>): Promise<T> =>
    cb({ execute: async () => undefined }),
} as never;

interface EvidenceOverrides {
  exams?: Array<{
    id: string;
    takenAt: Date;
    totalNet: string;
    updatedAt: Date;
  }>;
  subjects?: Array<{
    mockExamId: string;
    subjectRef: string;
    net: string;
    takenAt: Date;
  }>;
  sessions?: Array<{
    id: string;
    actualFocusSeconds: number;
    startedAt: Date;
    endedAt: Date | null;
    subject: string | null;
    updatedAt: Date;
  }>;
  tasks?: Array<{
    id: string;
    taskDate: string;
    subject: string | null;
    title?: string;
    status: "DONE";
    updatedAt: Date;
  }>;
}

function makeService(overrides: EvidenceOverrides = {}) {
  const configValues: Record<string, number> = {
    "coaching.session.min_focus_seconds": 300,
    "coaching.weekly_recap.ready_mock_exam_count": 1,
    "coaching.weekly_recap.ready_session_count": 2,
    "coaching.weekly_recap.ready_plan_task_count": 3,
    "coaching.weekly_recap.comparison_min_focus_minutes_delta": 15,
    "coaching.weekly_recap.comparison_min_longest_session_minutes_delta": 5,
    "coaching.weekly_recap.comparison_min_active_days_delta": 1,
    "coaching.weekly_recap.comparison_min_plan_tasks_delta": 1,
    "coaching.weekly_recap.title_rhythm_run_days": 4,
    "coaching.weekly_recap.title_deep_focus_minutes": 50,
    "coaching.weekly_recap.title_plan_task_count": 3,
    "coaching.weekly_recap.title_focused_subject_count": 3,
    "coaching.weekly_recap.title_mock_exam_count": 1,
    "coaching.weekly_recap.title_balanced_channel_count": 2,
  };
  const repository = {
    getEvidence: vi.fn(async () => ({
      exams: overrides.exams ?? [],
      subjects: overrides.subjects ?? [],
      photos: [],
      sessions: overrides.sessions ?? [],
      moods: [],
      tasks: overrides.tasks ?? [],
    })),
  };
  const service = new WeeklyReviewService(
    fakeDb,
    {
      getExamById: vi.fn(async () => ({ id: "exam" })),
      listExamSubjects: vi.fn(async () => [
        { slug: "turkce", name: "Türkçe", questionCount: 30 },
        { slug: "matematik", name: "Matematik", questionCount: 30 },
        { slug: "tarih", name: "Tarih", questionCount: 27 },
        { slug: "cografya", name: "Coğrafya", questionCount: 18 },
      ]),
    } as never,
    repository as never,
    {
      get: vi.fn(async (key: string) => configValues[key]),
    } as never,
    {
      translate: vi.fn(
        (key: string, options?: { args?: Record<string, unknown> }) =>
          `${key}:${JSON.stringify(options?.args ?? {})}`,
      ),
    } as never,
  );

  return { service, repository };
}

function session(
  id: string,
  actualFocusSeconds: number,
  endedAt = "2026-07-15T10:00:00.000Z",
  subject: string | null = null,
) {
  const endedAtDate = new Date(endedAt);
  return {
    id,
    actualFocusSeconds,
    startedAt: new Date(endedAtDate.getTime() - actualFocusSeconds * 1_000),
    endedAt: endedAtDate,
    subject,
    updatedAt: endedAtDate,
  };
}

function task(id: string, taskDate: string, subject: string | null) {
  return {
    id,
    taskDate,
    subject,
    title: "PRIVATE TASK TITLE",
    status: "DONE" as const,
    updatedAt: new Date(`${taskDate}T12:00:00.000Z`),
  };
}

describe("WeeklyReviewService recap evidence", () => {
  it("returns EMPTY and preserves the legacy INSUFFICIENT status without evidence", async () => {
    const review = await makeService().service.getReview(
      "user",
      "exam",
      new Date("2026-07-22T10:00:00.000Z"),
    );

    expect(review.status).toBe("INSUFFICIENT");
    expect(review.recap.status).toBe("EMPTY");
    expect(review.recap.nextStorySignal).toBeNull();
    expect(review.recap.nextStorySignals).toEqual([]);
    expect(review.suggestedTask).toBeNull();
  });

  it("ignores sub-minimum sessions and marks one qualifying session PARTIAL", async () => {
    const review = await makeService({
      sessions: [session("short", 299), session("qualified", 300)],
    }).service.getReview("user", "exam", new Date("2026-07-22T10:00:00.000Z"));

    expect(review.recap.status).toBe("PARTIAL");
    expect(review.recap.nextStorySignal).toEqual({
      kind: "PLAN_TASK",
      title: expect.stringContaining(
        "coaching.weekly.NEXT_STORY_SIGNAL_PLAN_TASK_TITLE",
      ),
      message: expect.stringContaining(
        "coaching.weekly.NEXT_STORY_SIGNAL_PLAN_TASK",
      ),
    });
    expect(review.recap.nextStorySignals).toEqual([
      {
        kind: "PLAN_TASK",
        title: expect.stringContaining(
          "coaching.weekly.NEXT_STORY_SIGNAL_PLAN_TASK_TITLE",
        ),
        message: expect.stringContaining(
          "coaching.weekly.NEXT_STORY_SIGNAL_PLAN_TASK",
        ),
      },
      {
        kind: "MOCK_EXAM",
        title: expect.stringContaining(
          "coaching.weekly.NEXT_STORY_SIGNAL_MOCK_EXAM_TITLE",
        ),
        message: expect.stringContaining(
          "coaching.weekly.NEXT_STORY_SIGNAL_MOCK_EXAM",
        ),
      },
    ]);
    expect(review.evidence).toMatchObject({
      qualifyingSessionCount: 1,
      completedPlanTaskCount: 0,
    });
    expect(review.rhythm).toMatchObject({
      completedSessionCount: 1,
      focusMinutes: 5,
    });
  });

  it("marks a tasks-only week READY and exposes only aggregate taxonomy subjects", async () => {
    const review = await makeService({
      tasks: [
        task("t1", "2026-07-13", "Türkçe"),
        task("t2", "2026-07-14", "turkce"),
        task("t3", "2026-07-14", "My private custom area"),
      ],
    }).service.getReview("user", "exam", new Date("2026-07-22T10:00:00.000Z"));

    expect(review.status).toBe("READY");
    expect(review.recap).toMatchObject({
      status: "READY",
      activeDays: 2,
      nextStorySignal: null,
      nextStorySignals: [],
    });
    expect(review.plan).toEqual({
      completedTaskCount: 3,
      subjectBreakdown: [
        {
          subjectRef: "turkce",
          subjectName: "Türkçe",
          completedTaskCount: 2,
        },
      ],
      message: expect.stringContaining("coaching.weekly.PLAN"),
    });
    expect(JSON.stringify(review)).not.toContain("My private custom area");
  });

  it("deduplicates mock, qualifying-session and completed-task Istanbul days", async () => {
    const date = "2026-07-13T08:00:00.000Z";
    const review = await makeService({
      exams: [
        {
          id: "m1",
          takenAt: new Date(date),
          totalNet: "50",
          updatedAt: new Date(date),
        },
      ],
      sessions: [session("s1", 600, date)],
      tasks: [task("t1", "2026-07-13", "Türkçe")],
    }).service.getReview("user", "exam", new Date("2026-07-22T10:00:00.000Z"));

    expect(review.recap.activeDays).toBe(1);
    expect(review.rhythm.activeDays).toBe(1);
  });

  it("uses calm copy when comparable net moves down", async () => {
    const review = await makeService({
      exams: [
        {
          id: "previous",
          takenAt: new Date("2026-07-07T08:00:00.000Z"),
          totalNet: "60",
          updatedAt: new Date("2026-07-07T08:00:00.000Z"),
        },
        {
          id: "current",
          takenAt: new Date("2026-07-14T08:00:00.000Z"),
          totalNet: "50",
          updatedAt: new Date("2026-07-14T08:00:00.000Z"),
        },
      ],
    }).service.getReview("user", "exam", new Date("2026-07-22T10:00:00.000Z"));

    expect(review.performance?.message).toContain(
      "coaching.weekly.PERFORMANCE_COMPARABLE_DOWN",
    );
  });

  it("fingerprints task identity, state, date and update time without titles", async () => {
    const { review, fingerprintInput } = await makeService({
      tasks: [task("t1", "2026-07-13", "Türkçe")],
    }).service.getAiEvidence(
      "user",
      "exam",
      new Date("2026-07-22T10:00:00.000Z"),
    );

    expect(review.evidence.completedPlanTaskCount).toBe(1);
    expect(fingerprintInput.taskUpdated).toEqual([
      ["t1", "DONE", "2026-07-13", "2026-07-13T12:00:00.000Z"],
    ]);
    expect(JSON.stringify(fingerprintInput)).not.toContain(
      "PRIVATE TASK TITLE",
    );
  });

  it("builds the wrapped rhythm, subject map, positive bests and dominant weekly title", async () => {
    const currentExamDate = "2026-07-18T08:00:00.000Z";
    const previousExamDate = "2026-07-10T08:00:00.000Z";
    const review = await makeService({
      exams: [
        {
          id: "previous",
          takenAt: new Date(previousExamDate),
          totalNet: "55",
          updatedAt: new Date(previousExamDate),
        },
        {
          id: "current",
          takenAt: new Date(currentExamDate),
          totalNet: "60",
          updatedAt: new Date(currentExamDate),
        },
      ],
      sessions: [
        session("p1", 70 * 60, "2026-07-06T08:00:00.000Z", "Matematik"),
        session("p2", 70 * 60, "2026-07-08T08:00:00.000Z", "Tarih"),
        session("p3", 70 * 60, "2026-07-10T08:00:00.000Z", "Matematik"),
        session("p4", 25 * 60, "2026-07-10T12:00:00.000Z", "Türkçe"),
        session("c1", 50 * 60, "2026-07-13T08:00:00.000Z", "Matematik"),
        session("c2", 80 * 60, "2026-07-14T08:00:00.000Z", "matematik"),
        session("c3", 45 * 60, "2026-07-15T08:00:00.000Z", "Tarih"),
        session("c4", 60 * 60, "2026-07-16T08:00:00.000Z", "Matematik"),
        session("c5", 30 * 60, "2026-07-18T08:00:00.000Z", "Coğrafya"),
      ],
      tasks: [
        task("p1", "2026-07-06", "Matematik"),
        task("p2", "2026-07-08", "Tarih"),
        task("c1", "2026-07-13", "Matematik"),
        task("c2", "2026-07-14", "Matematik"),
        task("c3", "2026-07-15", "Tarih"),
        task("c4", "2026-07-16", "Coğrafya"),
      ],
    }).service.getReview("user", "exam", new Date("2026-07-22T10:00:00.000Z"));

    expect(review.recap).toMatchObject({
      status: "READY",
      activeDays: 5,
      weeklyTitle: {
        id: "FOCUS_DIVER",
        label: expect.stringContaining("TITLE_FOCUS_DIVER_LABEL"),
        message: expect.stringContaining("TITLE_FOCUS_DIVER_MESSAGE"),
      },
    });
    expect(review.rhythm).toMatchObject({
      focusMinutes: 265,
      longestSessionMinutes: 80,
      longestActiveRun: 4,
      activeDays: 5,
      focusTimeBand: {
        id: "MORNING",
        label: expect.stringContaining(
          "coaching.weekly.FOCUS_TIME_MORNING_LABEL",
        ),
        focusMinutes: 265,
        qualifyingSessionCount: 5,
        message: expect.stringContaining(
          "coaching.weekly.FOCUS_TIME_MORNING",
        ),
      },
      peakFocusDay: {
        date: "2026-07-14",
        focusMinutes: 80,
        message: expect.stringContaining("coaching.weekly.PEAK_FOCUS_DAY"),
      },
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
    expect(review.rhythm.subjectBreakdown).toEqual([
      {
        subjectRef: "matematik",
        subjectName: "Matematik",
        focusMinutes: 190,
        qualifyingSessionCount: 3,
      },
      {
        subjectRef: "tarih",
        subjectName: "Tarih",
        focusMinutes: 45,
        qualifyingSessionCount: 1,
      },
      {
        subjectRef: "cografya",
        subjectName: "Coğrafya",
        focusMinutes: 30,
        qualifyingSessionCount: 1,
      },
    ]);
    expect(review.highlights).toMatchObject([
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
});
