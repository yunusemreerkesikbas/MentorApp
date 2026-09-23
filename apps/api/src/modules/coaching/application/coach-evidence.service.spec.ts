import { CoachEvidenceType } from "@mentor/types";
import { CoachEvidenceService } from "./coach-evidence.service";

const now = new Date("2026-08-01T12:00:00.000Z");

const strength = (
  subjectRef: string,
  subjectName: string,
  averageNet: string,
  normalizedAveragePercent: string | null,
) => ({
  subjectRef,
  subjectName,
  averageNet,
  attemptCount: 3,
  questionCount: normalizedAveragePercent === null ? null : 30,
  normalizedAveragePercent,
  recentAverageNet: null as string | null,
  netDelta: null,
});

const topic = (
  subjectRef: string,
  subjectName: string,
  topicName: string,
  count: number,
) => ({
  subjectRef,
  subjectName,
  topicRef: topicName.toLocaleLowerCase("tr-TR"),
  topicName,
  count,
  sharePercent: 10,
});

function defaultAnalysis() {
  return {
    trend: [
      { totalNet: "61.25", takenAt: now.toISOString() },
      { totalNet: "58.00", takenAt: "2026-07-20T12:00:00.000Z" },
    ],
    nextFocus: { subjectRef: "matematik", subjectName: "Matematik" },
    subjects: [
      strength("turkce", "Türkçe", "28.50", "71.25"),
      strength("matematik", "Matematik", "9.60", "32.00"),
      strength("fen", "Fen Bilimleri", "8.20", "41.00"),
      strength("tarih", "Tarih", "12.00", null),
    ],
    photoTopicSignals: [
      topic("matematik", "Matematik", "Problemler", 5),
      topic("turkce", "Türkçe", "Paragraf", 3),
      topic("fen", "Fen Bilimleri", "Kuvvet", 1),
    ],
    notebookErrorSignals: [],
    notebookStats: {
      windowDays: 60,
      savedCount: 9,
      reviewedCount: 4,
      dueCount: 3,
      healedCount: 1,
    },
    improvementCycle: {
      task: {
        id: "task-1",
        title: "Ham analiz görevi",
        status: "PENDING",
        taskDate: "2026-08-01",
        createdAt: now.toISOString(),
      },
    },
  };
}

function defaultWeekly() {
  return {
    period: { startDate: "2026-07-20", endDate: "2026-07-26" },
    current: {
      focusMinutes: 185,
      sessions: 6,
      activeDays: 4,
      plannedTasks: 8,
      completedTasks: 5,
      completionRate: 63,
      hasRecordedActivity: true,
    },
    subjects: [
      {
        subjectRef: "turkce",
        currentFocusMinutes: 45,
        currentSessions: 2,
        previousFocusMinutes: 0,
        previousSessions: 0,
      },
      {
        subjectRef: "matematik",
        currentFocusMinutes: 120,
        currentSessions: 3,
        previousFocusMinutes: 60,
        previousSessions: 1,
      },
      {
        subjectRef: null,
        currentFocusMinutes: 20,
        currentSessions: 1,
        previousFocusMinutes: 0,
        previousSessions: 0,
      },
      {
        subjectRef: "bilinmeyen-ders",
        currentFocusMinutes: 300,
        currentSessions: 4,
        previousFocusMinutes: 0,
        previousSessions: 0,
      },
    ],
  };
}

function makeService(
  options: {
    dailyFocusGoalMinutes?: number | null;
    taskSubjects?: Array<string | null>;
    dominantTimeBand?: "MORNING" | "AFTERNOON" | "EVENING" | null;
    mockTotal?: number;
    examDate?: string;
    weekly?: ReturnType<typeof defaultWeekly> | Error;
    analysis?: ReturnType<typeof defaultAnalysis>;
  } = {},
) {
  const users = {
    getMe: vi.fn(async () => ({
      examType: "YKS",
      examVariant: null,
      dailyFocusGoalMinutes:
        options.dailyFocusGoalMinutes === undefined
          ? 120
          : options.dailyFocusGoalMinutes,
      displayName: "Gizli İsim",
      email: "hidden@example.com",
    })),
  };
  const plan = {
    listForDate: vi.fn(async () =>
      (options.taskSubjects ?? ["matematik", "Bilinmeyen", "Matematik"]).map(
        (subject, index) => ({
          title: `Ham görev başlığı ${index}`,
          subject,
          status: index === 0 ? "DONE" : "PENDING",
        }),
      ),
    ),
    getAiCoachOutcomeSummary: vi.fn(async () => ({
      accepted: 2,
      completed: 1,
      lastStatus: "DONE",
      observedAt: now,
      pendingTaskId: "00000000-0000-4000-8000-000000000010",
    })),
  };
  const sessions = {
    getCoachRhythm: vi.fn(async () => ({
      todayFocusMinutes: 35,
      sessions7d: 4,
      focusMinutes7d: 170,
      activeDays7d: 3,
      averageSessionMinutes7d: 43,
      sessions28d: 12,
      focusMinutes28d: 520,
      activeDays28d: 10,
      averageSessionMinutes28d: 43,
      dominantTimeBand:
        options.dominantTimeBand === undefined
          ? "EVENING"
          : options.dominantTimeBand,
      lastActiveAt: now.toISOString(),
    })),
  };
  const moods = {
    getCoachMoodEvidence: vi.fn(async () => ({
      today: 2,
      trend: "DOWN",
      observedAt: now,
    })),
  };
  const streak = {
    getCoachEvidence: vi.fn(async () => ({
      currentStreak: 3,
      lastActiveDate: "2026-08-01",
    })),
  };
  const mockTotal = options.mockTotal ?? 4;
  const mockExams = {
    list: vi.fn(async () => ({
      items:
        mockTotal > 0 ? [{ totalNet: "61.25", takenAt: now.toISOString() }] : [],
      total: mockTotal,
      page: 1,
      pageSize: 1,
    })),
    getAnalysis: vi.fn(async () => options.analysis ?? defaultAnalysis()),
  };
  const vision = {
    getMine: vi.fn(async () => ({
      goalTitle: "Doktor olmak istiyorum - ham metin",
      motivation: "Aileme söz verdim - ham metin",
      careerGroup: "SAGLIK",
      targetCityCode: "34",
      targetCity: null,
      targetUniversityId: null,
      updatedAt: now.toISOString(),
    })),
  };
  const content = {
    getExamCalendar: vi.fn(async () => ({
      examId: "exam-1",
      ...(options.examDate ? { examDate: options.examDate } : {}),
    })),
    listExamSubjects: vi.fn(async () => [
      { slug: "matematik", name: "Matematik" },
      { slug: "turkce", name: "Türkçe" },
      { slug: "fen", name: "Fen Bilimleri" },
    ]),
  };
  const i18n = {
    translate: vi.fn(
      (key: string, options?: { args?: Record<string, unknown> }) =>
        `${key}:${JSON.stringify(options?.args ?? {})}`,
    ),
  };
  const weekly = {
    getSnapshot: vi.fn(async () => {
      if (options.weekly instanceof Error) throw options.weekly;
      return options.weekly ?? defaultWeekly();
    }),
  };

  const service = new CoachEvidenceService(
    users as never,
    plan as never,
    sessions as never,
    moods as never,
    streak as never,
    mockExams as never,
    mockExams as never,
    vision as never,
    content as never,
    i18n as never,
    weekly as never,
  );
  return { service, mockExams, weekly };
}

const summaryOf = (
  snapshot: { evidence: Array<{ type: string; summary: string }> },
  type: CoachEvidenceType,
) => snapshot.evidence.find((item) => item.type === type)?.summary;

describe("CoachEvidenceService", () => {
  it("builds a PII-minimal deterministic snapshot from verified aggregates", async () => {
    const snapshot = await makeService().service.build("user-1", now);

    expect(snapshot).toMatchObject({
      examType: "YKS",
      dailyFocusGoalMinutes: 120,
      moodLevel: 2,
      moodTrend: "DOWN",
      planCompletionRate: 33,
      pendingAiCoachPlanTaskId: "00000000-0000-4000-8000-000000000010",
    });
    expect(snapshot.evidence.map((item) => item.type)).toEqual(
      expect.arrayContaining([
        CoachEvidenceType.TODAY_PLAN,
        CoachEvidenceType.RECENT_RHYTHM,
        CoachEvidenceType.LONG_TERM_RHYTHM,
        CoachEvidenceType.MOCK_PERFORMANCE,
        CoachEvidenceType.GOAL,
        CoachEvidenceType.ACTION_OUTCOME,
      ]),
    );
    const serialized = JSON.stringify(snapshot);
    expect(serialized).not.toContain("Ham görev başlığı");
    expect(serialized).not.toContain("Ham analiz görevi");
    expect(serialized).not.toContain("hidden@example.com");
    expect(serialized).not.toContain("Aileme söz verdim");
    expect(serialized).not.toContain("Gizli İsim");
    expect(serialized).not.toContain("Bilinmeyen");
    expect(serialized).not.toContain("bilinmeyen-ders");
    expect(serialized).toContain("Matematik");
    expect(serialized).toContain("SAGLIK");
  });

  it("returns a partial snapshot when an optional evidence source is unavailable", async () => {
    const { service } = makeService();
    vi.spyOn(service as never, "loadMockEvidence" as never).mockRejectedValue(
      new Error("unavailable"),
    );

    await expect(service.build("user-1", now)).resolves.toBeDefined();
  });

  it("uses honest localized variants when a goal, subject distribution, or time band is absent", async () => {
    const snapshot = await makeService({
      dailyFocusGoalMinutes: null,
      taskSubjects: ["Bilinmeyen"],
      dominantTimeBand: null,
    }).service.build("user-1", now);

    expect(summaryOf(snapshot, CoachEvidenceType.TODAY_FOCUS)).toContain(
      "todayFocusNoGoal",
    );
    expect(summaryOf(snapshot, CoachEvidenceType.TODAY_PLAN)).toContain(
      "todayPlanNoSubjects",
    );
    expect(summaryOf(snapshot, CoachEvidenceType.RECENT_RHYTHM)).toContain(
      "recentRhythmNoTimeBand",
    );
  });

  it("formats nets for the reader instead of the database", async () => {
    const snapshot = await makeService().service.build("user-1", now);

    expect(summaryOf(snapshot, CoachEvidenceType.MOCK_PERFORMANCE)).toContain(
      '"latestNet":"61,25"',
    );
  });

  it("writes the streak day as a date a student reads", async () => {
    const snapshot = await makeService().service.build("user-1", now);

    expect(summaryOf(snapshot, CoachEvidenceType.STREAK)).toContain(
      '"lastActiveDate":"1 Ağustos"',
    );
  });

  it("adds weak subjects and repeated notebook topics from the analysis it already loads", async () => {
    const { service, mockExams } = makeService();
    const snapshot = await service.build("user-1", now);

    expect(mockExams.getAnalysis).toHaveBeenCalledTimes(1);
    expect(snapshot.weakSubjects).toEqual(["Matematik", "Fen Bilimleri"]);
    expect(summaryOf(snapshot, CoachEvidenceType.WEAK_SUBJECTS)).toBe(
      'coaching.coachEvidence.weakSubjects:{"subjects":"Matematik (9,6), Fen Bilimleri (8,2)"}',
    );
    expect(summaryOf(snapshot, CoachEvidenceType.NOTEBOOK_TOPICS)).toBe(
      'coaching.coachEvidence.notebookTopicsDue:{"topics":"Problemler (5), Paragraf (3)","due":3}',
    );
  });

  it("shows the recent average the ranking used", async () => {
    const analysis = defaultAnalysis();
    analysis.subjects = [
      { ...strength("turkce", "Türkçe", "28.50", "95.00"), recentAverageNet: "28.50" },
      { ...strength("matematik", "Matematik", "9.60", "32.00"), recentAverageNet: "12.30" },
      { ...strength("fen", "Fen Bilimleri", "8.20", "41.00"), recentAverageNet: "15.00" },
    ];
    const snapshot = await makeService({ analysis }).service.build("user-1", now);

    expect(summaryOf(snapshot, CoachEvidenceType.WEAK_SUBJECTS)).toBe(
      'coaching.coachEvidence.weakSubjects:{"subjects":"Matematik (12,3), Fen Bilimleri (15)"}',
    );
  });

  it("exposes the analysis focus subject even before the first mock exam", async () => {
    const snapshot = await makeService({ mockTotal: 0 }).service.build(
      "user-1",
      now,
    );

    expect(snapshot.focusSubject).toBe("Matematik");
  });

  it("keeps notebook topics for a student who has not added a mock exam yet", async () => {
    const snapshot = await makeService({ mockTotal: 0 }).service.build(
      "user-1",
      now,
    );

    expect(summaryOf(snapshot, CoachEvidenceType.MOCK_PERFORMANCE)).toBeUndefined();
    expect(summaryOf(snapshot, CoachEvidenceType.NOTEBOOK_TOPICS)).toBeDefined();
    expect(snapshot.coverage.mockCount).toBe(0);
  });

  it("adds last week's subject balance and plan follow-through from the weekly snapshot", async () => {
    const { service, weekly } = makeService();
    const snapshot = await service.build("user-1", now);

    expect(weekly.getSnapshot).toHaveBeenCalledWith("user-1", "YKS", undefined, now);
    expect(summaryOf(snapshot, CoachEvidenceType.SUBJECT_BALANCE)).toBe(
      'coaching.coachEvidence.subjectBalanceGap:{"subjects":"Matematik (120), Türkçe (45)","gap":"Fen Bilimleri"}',
    );
    expect(summaryOf(snapshot, CoachEvidenceType.PLAN_FOLLOW_THROUGH)).toBe(
      'coaching.coachEvidence.planFollowThrough:{"planned":8,"completed":5}',
    );
  });

  it("keeps the rest of the snapshot when the weekly source fails", async () => {
    const snapshot = await makeService({
      weekly: new Error("weekly unavailable"),
    }).service.build("user-1", now);

    expect(summaryOf(snapshot, CoachEvidenceType.SUBJECT_BALANCE)).toBeUndefined();
    expect(summaryOf(snapshot, CoachEvidenceType.PLAN_FOLLOW_THROUGH)).toBeUndefined();
    expect(summaryOf(snapshot, CoachEvidenceType.WEAK_SUBJECTS)).toBeDefined();
  });

  it("turns the verified exam date into a coarse phase and never passes the date on", async () => {
    const snapshot = await makeService({ examDate: "2026-08-20" }).service.build(
      "user-1",
      now,
    );

    expect(snapshot.examPhase).toBe("FINAL");
    expect(summaryOf(snapshot, CoachEvidenceType.EXAM_PHASE)).toBe(
      "coaching.coachEvidence.examPhase.FINAL:{}",
    );
    expect(JSON.stringify(snapshot)).not.toContain("2026-08-20");
  });

  it("leaves the phase out when the calendar has no verified date", async () => {
    const snapshot = await makeService().service.build("user-1", now);

    expect(snapshot.examPhase).toBeNull();
    expect(summaryOf(snapshot, CoachEvidenceType.EXAM_PHASE)).toBeUndefined();
  });

  it("exposes coverage and rhythm numbers for deterministic callers", async () => {
    const snapshot = await makeService().service.build("user-1", now);

    expect(snapshot.coverage).toEqual({
      mockCount: 4,
      notebookCount: 9,
      sessions28d: 12,
    });
    expect(snapshot.activeDays28d).toBe(10);
    expect(snapshot.averageSessionMinutes28d).toBe(43);
  });
});
