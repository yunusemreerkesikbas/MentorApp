import { HttpStatus } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CoachEvidenceType } from "@mentor/types";
import { FeatureFlag } from "../../../common/config/config.catalog";
import { DomainError } from "../../../common/errors/domain-error";
import { ErrorCode } from "../../../common/errors/error-code";
import { AiUsageFeature } from "../domain/ai.constants";
import { PlanAdaptationService } from "./plan-adaptation.service";

const USER = { id: "u1", roles: ["STUDENT"] } as never;
const TODAY = new Date().toISOString().slice(0, 10);
const TOMORROW = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
const WEAK =
  "Denemelerinde en çok desteğe ihtiyaç duyan dersler (ortalama net): Matematik (9,6), Tarih (12).";
const TOPICS = "Yanlış defterinde en çok kart biriken konular: Problemler (5).";

const evidenceItem = (type: CoachEvidenceType, summary: string) => ({
  type,
  summary,
  observedAt: "2026-09-20T09:00:00.000Z",
});

function evidenceSnapshot() {
  return {
    examType: "KPSS",
    dailyFocusGoalMinutes: 60,
    moodLevel: 1,
    moodTrend: "DOWN",
    planCompletionRate: 50,
    pendingAiCoachPlanTaskId: null,
    weakSubjects: ["Matematik", "Tarih"],
    focusSubject: "Matematik",
    examPhase: "FINAL",
    activeDays28d: 20,
    averageSessionMinutes28d: 43,
    // Sunday is the rarest day, so a five-day rhythm leaves it out.
    weekdayActivity28d: [1, 2, 3, 4, 5, 6, 7].map((weekday) => ({
      weekday,
      activeDays: weekday === 7 ? 1 : 3,
      focusMinutes: weekday === 4 ? 40 : 120,
    })),
    coverage: { mockCount: 4, notebookCount: 9, sessions28d: 12 },
    // Never part of the snapshot contract; proves nothing outside `evidence` reaches the prompt.
    struggleNote: "private mood note",
    evidence: [
      evidenceItem(CoachEvidenceType.MOOD, "Bugünkü enerjin 5 üzerinden 1."),
      evidenceItem(CoachEvidenceType.RECENT_RHYTHM, "Son 7 günde 3 gün çalıştın."),
      evidenceItem(CoachEvidenceType.TODAY_PLAN, "Bugünkü planında 2 görevin 1 tanesi tamam."),
      evidenceItem(CoachEvidenceType.WEAK_SUBJECTS, WEAK),
      evidenceItem(CoachEvidenceType.NOTEBOOK_TOPICS, TOPICS),
      evidenceItem(CoachEvidenceType.EXAM_PHASE, "Sınavına 30 günden az kaldı."),
      evidenceItem(CoachEvidenceType.GOAL, "Hedef alanın: Sağlık."),
    ],
  };
}

describe("PlanAdaptationService", () => {
  let complete: ReturnType<typeof vi.fn>;
  let append: ReturnType<typeof vi.fn>;
  let countFeaturesSince: ReturnType<typeof vi.fn>;
  let getSnapshot: ReturnType<typeof vi.fn>;
  let getMood: ReturnType<typeof vi.fn>;
  let getSession: ReturnType<typeof vi.fn>;
  let getEntitlement: ReturnType<typeof vi.fn>;
  let buildEvidence: ReturnType<typeof vi.fn>;
  let getProfile: ReturnType<typeof vi.fn>;
  let getPromptMemories: ReturnType<typeof vi.fn>;
  let assertWithinBudget: ReturnType<typeof vi.fn>;
  let aiEnabled: boolean;
  let service: PlanAdaptationService;

  beforeEach(() => {
    aiEnabled = true;
    complete = vi.fn(async () => ({
      text: JSON.stringify({
        changes: [{ kind: "MOVE", taskRef: "T1", toDate: TOMORROW }],
      }),
      promptTokens: 10,
      completionTokens: 5,
      model: "fake",
    }));
    append = vi.fn(async () => undefined);
    countFeaturesSince = vi.fn(async () => 0);
    getSnapshot = vi.fn(async () => ({
      window: {
        from: TODAY,
        to: new Date(Date.now() + 6 * 86_400_000).toISOString().slice(0, 10),
      },
      planRevision: "revision",
      tasks: [
        {
          id: "task-1",
          taskDate: TODAY,
          title: "Matematik çöz",
          subject: "Matematik",
          status: "PENDING",
          sortOrder: 0,
        },
        {
          id: "done-1",
          taskDate: TODAY,
          title: "Tamamlanan görev",
          subject: null,
          status: "DONE",
          sortOrder: 1,
        },
      ],
    }));
    getMood = vi.fn(async () => ({ mood: 1 }));
    getSession = vi.fn(async () => ({
      id: "session-1",
      status: "COMPLETED",
      sessionMood: 1,
    }));
    getEntitlement = vi.fn(async () => ({ isPremium: true }));
    buildEvidence = vi.fn(async () => evidenceSnapshot());
    getProfile = vi.fn(async () => ({
      calibrationStatus: "COMPLETED",
      memoryConsent: "DECLINED",
      supportPreference: null,
      directnessPreference: null,
      updatedAt: "2026-09-20T09:00:00.000Z",
    }));
    getPromptMemories = vi.fn(async () => [
      { id: "m1", key: "STUDY_TIME", value: "EVENING" },
    ]);
    assertWithinBudget = vi.fn(async () => undefined);

    service = new PlanAdaptationService(
      { complete } as never,
      { getAdaptationSnapshot: getSnapshot } as never,
      { getToday: getMood } as never,
      { getById: getSession } as never,
      { build: buildEvidence } as never,
      { append, countFeaturesSince } as never,
      {
        get: vi.fn(async (key: string) => {
          if (key === FeatureFlag.AI_ENABLED) return aiEnabled;
          if (key === "ai.plan_draft.daily_limit") return 5;
          return null;
        }),
      } as never,
      {
        assertAllowed: async () => {
          if (!(await getEntitlement()).isPremium) {
            throw new DomainError(
              ErrorCode.PAYMENT_PREMIUM_REQUIRED,
              HttpStatus.FORBIDDEN,
            );
          }
        },
      } as never,
      { assertWithinBudget } as never,
      { translate: vi.fn((key: string) => key) } as never,
      { getProfile, getPromptMemories } as never,
    );
  });

  it("requires Premium before calling the provider", async () => {
    getEntitlement.mockResolvedValue({ isPremium: false });
    await expect(
      service.preview(USER, { source: "PLAN" }),
    ).rejects.toMatchObject({
      code: ErrorCode.PAYMENT_PREMIUM_REQUIRED,
      httpStatus: HttpStatus.FORBIDDEN,
    });
    expect(complete).not.toHaveBeenCalled();
  });

  it("shares the plan-draft daily quota", async () => {
    countFeaturesSince.mockResolvedValue(5);
    await expect(
      service.preview(USER, { source: "PLAN" }),
    ).rejects.toMatchObject({
      code: ErrorCode.AI_RATE_LIMITED,
      httpStatus: HttpStatus.TOO_MANY_REQUESTS,
    });
    expect(countFeaturesSince).toHaveBeenCalledWith(
      "u1",
      [AiUsageFeature.PLAN_DRAFT, AiUsageFeature.PLAN_ADAPTATION],
      expect.any(Date),
    );
  });

  it("rejects MOOD unless today's backend mood is 1-2", async () => {
    getMood.mockResolvedValue({ mood: 3 });
    await expect(
      service.preview(USER, { source: "MOOD" }),
    ).rejects.toMatchObject({
      code: ErrorCode.AI_PLAN_ADAPTATION_NOT_APPLICABLE,
      httpStatus: HttpStatus.CONFLICT,
    });
    expect(complete).not.toHaveBeenCalled();
  });

  it("returns deterministic NO_CHANGE for MOOD without today's pending tasks", async () => {
    getSnapshot.mockResolvedValue({
      window: { from: TODAY, to: TODAY },
      planRevision: "revision",
      tasks: [],
    });
    const result = await service.preview(USER, { source: "MOOD" });
    expect(result).toMatchObject({
      status: "NO_CHANGE",
      changes: [],
      model: "rules",
      groundingLine: "Bugün seni bekleyen bir görev yok. Dinlenmek de planın parçası.",
      message: "coaching.planAdaptation.REST",
    });
    expect(result.usedEvidence?.map((item) => item.type)).toEqual([
      CoachEvidenceType.MOOD,
      CoachEvidenceType.RECENT_RHYTHM,
      CoachEvidenceType.TODAY_PLAN,
    ]);
    expect(complete).not.toHaveBeenCalled();
    expect(append).not.toHaveBeenCalled();
  });

  it("says today's work is done instead of offering nothing when every task is finished", async () => {
    getSnapshot.mockResolvedValue({
      window: { from: TODAY, to: TODAY },
      planRevision: "revision",
      tasks: [
        {
          id: "done-1",
          taskDate: TODAY,
          title: "Tamamlanan görev",
          subject: null,
          status: "DONE",
          sortOrder: 0,
        },
      ],
    });

    const result = await service.preview(USER, { source: "MOOD" });

    expect(result.groundingLine).toBe(
      "Bugünkü 1 görevini tamamlamışsın. Bugün dinlenmek de planın parçası.",
    );
    expect(result.message).toBe("coaching.planAdaptation.REST");
    expect(complete).not.toHaveBeenCalled();
  });

  it("validates owned completed SESSION with sessionMood=1", async () => {
    getSession.mockResolvedValue({
      id: "session-1",
      status: "COMPLETED",
      sessionMood: 2,
    });
    await expect(
      service.preview(USER, {
        source: "SESSION",
        sessionId: "dd9974b8-b010-4df8-a4fa-3d6bbd17e75d",
      }),
    ).rejects.toMatchObject({
      code: ErrorCode.AI_PLAN_ADAPTATION_NOT_APPLICABLE,
    });
    expect(complete).not.toHaveBeenCalled();
  });

  it("sends only opaque pending task refs and verified evidence, then meters adaptation usage", async () => {
    const result = await service.preview(USER, {
      source: "PLAN",
      note: "Cuma günü hafif olsun",
    });

    expect(result).toMatchObject({
      status: "READY",
      planRevision: "revision",
      changes: [
        { kind: "MOVE", taskId: "task-1", fromDate: TODAY, toDate: TOMORROW },
      ],
      model: "fake",
    });
    const prompt = complete.mock.calls[0][0];
    expect(prompt.user).toContain('"ref":"T1"');
    expect(prompt.user).not.toContain("task-1");
    expect(prompt.user).not.toContain("done-1");
    expect(prompt.user).not.toContain("private mood note");
    expect(prompt.user).toContain("Cuma günü hafif olsun");
    expect(prompt.user).toContain("Ruh hali: çok düşük");
    expect(result.message).toBe("coaching.planAdaptation.READY");
    expect(result.groundingLine).toBe(
      "4 denemene, 9 yanlış kartına ve son 28 gündeki 12 seansına baktık.",
    );
    expect(append.mock.calls[0][0].feature).toBe(
      AiUsageFeature.PLAN_ADAPTATION,
    );
  });

  it("grounds a plan request in the evidence pool and returns the reasons it chose", async () => {
    complete.mockResolvedValue({
      text: JSON.stringify({
        changes: [
          {
            kind: "ADD",
            title: "Problemler 10 soru",
            subject: "Matematik",
            taskDate: TOMORROW,
            evidenceRef: "E3",
          },
        ],
      }),
      promptTokens: 10,
      completionTokens: 5,
      model: "fake",
    });

    const result = await service.preview(USER, { source: "PLAN" });

    const prompt = complete.mock.calls[0][0];
    expect(prompt.user).toContain("E1 | EXAM_PHASE | Sınavına 30 günden az kaldı.");
    expect(prompt.user).toContain(`E2 | WEAK_SUBJECTS | ${WEAK}`);
    expect(prompt.user).toContain(`E3 | NOTEBOOK_TOPICS | ${TOPICS}`);
    expect(prompt.system).toContain("Sınav son düzlükte");
    expect(result.usedEvidence?.map((item) => item.type)).toEqual([
      CoachEvidenceType.EXAM_PHASE,
      CoachEvidenceType.WEAK_SUBJECTS,
      CoachEvidenceType.NOTEBOOK_TOPICS,
      CoachEvidenceType.RECENT_RHYTHM,
      CoachEvidenceType.MOOD,
      CoachEvidenceType.GOAL,
    ]);
    expect(result.usedEvidence?.[0]).not.toHaveProperty("ref");
    expect(result.changes[0]).toMatchObject({
      kind: "ADD",
      title: "Problemler 10 soru",
      reason: TOPICS,
    });
  });

  it("adds structured memory only after the student consented", async () => {
    await service.preview(USER, { source: "PLAN" });
    expect(complete.mock.calls[0][0].user).not.toContain("STUDY_TIME");
    expect(getPromptMemories).not.toHaveBeenCalled();

    getProfile.mockResolvedValue({
      calibrationStatus: "COMPLETED",
      memoryConsent: "GRANTED",
      supportPreference: "ACTION",
      directnessPreference: "DIRECT",
      updatedAt: "2026-09-20T09:00:00.000Z",
    });
    await service.preview(USER, { source: "PLAN" });
    const prompt = complete.mock.calls[1][0].user as string;
    expect(prompt).toContain("STUDY_TIME=EVENING");
    expect(prompt).toContain("destek=ACTION");
  });

  it("keeps a low-mood adaptation on the narrow context", async () => {
    getProfile.mockResolvedValue({
      calibrationStatus: "COMPLETED",
      memoryConsent: "GRANTED",
      supportPreference: null,
      directnessPreference: null,
      updatedAt: "2026-09-20T09:00:00.000Z",
    });

    const result = await service.preview(USER, { source: "MOOD" });

    const prompt = complete.mock.calls[0][0].user as string;
    expect(prompt).toContain("E1 | MOOD |");
    expect(prompt).not.toContain("WEAK_SUBJECTS");
    expect(prompt).not.toContain("STUDY_TIME");
    expect(result.groundingLine).toBe("Bekleyen işlerin arasında Matematik var.");
  });

  it("puts the selected study rhythm into the model prompt", async () => {
    await service.preview(USER, {
      source: "PLAN",
      days: 5,
      minutesPerDay: 90,
      focusSubjects: ["Tarih"],
    });

    const prompt = complete.mock.calls.at(-1)?.[0];
    expect(prompt.system).toContain("Tam 5 farklı güne");
    expect(prompt.user).toContain("90 dakika");
    expect(prompt.user).toContain("Tarih");
  });

  it("keeps the plan on the weekdays the student picked", async () => {
    const tomorrowWeekday = ((new Date(`${TOMORROW}T00:00:00Z`).getUTCDay() + 6) % 7) + 1;
    complete.mockResolvedValue({
      text: JSON.stringify({
        changes: [
          { kind: "ADD", title: "Bugün blok", taskDate: TODAY },
          { kind: "ADD", title: "Yarın blok", taskDate: TOMORROW },
        ],
      }),
      promptTokens: 4,
      completionTokens: 3,
      model: "fake",
    });

    const result = await service.preview(USER, {
      source: "PLAN",
      studyWeekdays: [tomorrowWeekday],
    });

    expect(complete.mock.calls.at(-1)?.[0].system).toContain(`Yalnız şu günlere birer ADD yaz: ${TOMORROW}`);
    expect(result.changes).toEqual([
      expect.objectContaining({ kind: "ADD", title: "Yarın blok", taskDate: TOMORROW }),
    ]);
  });

  it("rejects a SESSION that is not owned or no longer exists", async () => {
    getSession.mockResolvedValue(null);
    await expect(
      service.preview(USER, {
        source: "SESSION",
        sessionId: "dd9974b8-b010-4df8-a4fa-3d6bbd17e75d",
      }),
    ).rejects.toMatchObject({
      code: ErrorCode.COACHING_SESSION_NOT_FOUND,
      httpStatus: HttpStatus.NOT_FOUND,
    });
    expect(complete).not.toHaveBeenCalled();
  });

  it("returns only ADD suggestions when the PLAN snapshot has no pending tasks", async () => {
    getSnapshot.mockResolvedValue({
      window: {
        from: TODAY,
        to: new Date(Date.now() + 6 * 86_400_000).toISOString().slice(0, 10),
      },
      planRevision: "empty-revision",
      tasks: [
        {
          id: "done-1",
          taskDate: TODAY,
          title: "Tamamlanan görev",
          subject: null,
          status: "DONE",
          sortOrder: 0,
        },
      ],
    });
    complete.mockResolvedValue({
      text: JSON.stringify({
        changes: [{ kind: "ADD", title: "Kısa başlangıç", taskDate: TOMORROW }],
      }),
      promptTokens: 4,
      completionTokens: 3,
      model: "fake",
    });

    const result = await service.preview(USER, { source: "PLAN" });

    expect(result).toMatchObject({
      status: "READY",
      planRevision: "empty-revision",
      changes: [
        {
          kind: "ADD",
          title: "Kısa başlangıç",
          subject: null,
          taskDate: TOMORROW,
        },
      ],
    });
    expect(complete.mock.calls[0][0].user).not.toContain("done-1");
    expect(complete.mock.calls[0][0].user).not.toContain("Tamamlanan görev");
  });

  it("caps model-visible tasks while retaining the full plan snapshot", async () => {
    getSnapshot.mockResolvedValue({
      window: {
        from: TODAY,
        to: new Date(Date.now() + 6 * 86_400_000).toISOString().slice(0, 10),
      },
      planRevision: "large-revision",
      tasks: Array.from({ length: 25 }, (_, index) => ({
        id: `task-${index + 1}`,
        taskDate: TODAY,
        title: `Görev ${index + 1}`,
        subject: null,
        status: "PENDING",
        sortOrder: index,
      })),
    });
    complete.mockResolvedValue({
      text: '{"changes":[]}',
      promptTokens: 10,
      completionTokens: 2,
      model: "fake",
    });

    await service.preview(USER, { source: "PLAN" });

    const prompt = complete.mock.calls[0][0].user as string;
    expect(prompt).toContain('"ref":"T21"');
    expect(prompt).toContain('"title":"Görev 21"');
    expect(prompt).not.toContain('"title":"Görev 22"');
    expect(prompt).not.toContain('"ref":"T22"');
  });

  it("meters malformed provider output but never mutates the plan", async () => {
    complete.mockResolvedValue({
      text: "bad-json",
      promptTokens: 1,
      completionTokens: 1,
      model: "fake",
    });
    await expect(
      service.preview(USER, { source: "PLAN" }),
    ).rejects.toMatchObject({
      code: ErrorCode.AI_PROVIDER_ERROR,
      httpStatus: HttpStatus.SERVICE_UNAVAILABLE,
    });
    expect(append).toHaveBeenCalledOnce();
  });

  describe("brief", () => {
    it("seeds the wizard from the pool without calling the model or spending quota", async () => {
      const brief = await service.brief(USER);

      const byType = new Map(
        evidenceSnapshot().evidence.map((item) => [item.type, item]),
      );
      expect(brief).toEqual({
        groundingLine:
          "4 denemene, 9 yanlış kartına ve son 28 gündeki 12 seansına baktık.",
        evidence: [
          CoachEvidenceType.EXAM_PHASE,
          CoachEvidenceType.WEAK_SUBJECTS,
          CoachEvidenceType.NOTEBOOK_TOPICS,
          CoachEvidenceType.RECENT_RHYTHM,
          CoachEvidenceType.MOOD,
          CoachEvidenceType.GOAL,
        ].map((type) => byType.get(type)),
        suggestion: {
          days: 5,
          weekdays: [1, 2, 3, 5, 6],
          minutesPerDay: 60,
          focusSubjects: ["Matematik", "Tarih"],
        },
      });
      expect(complete).not.toHaveBeenCalled();
      expect(append).not.toHaveBeenCalled();
      expect(countFeaturesSince).not.toHaveBeenCalled();
      expect(assertWithinBudget).not.toHaveBeenCalled();
    });

    it("stays behind the premium gate", async () => {
      getEntitlement.mockResolvedValue({ isPremium: false });
      await expect(service.brief(USER)).rejects.toMatchObject({
        code: ErrorCode.PAYMENT_PREMIUM_REQUIRED,
        httpStatus: HttpStatus.FORBIDDEN,
      });
      expect(buildEvidence).not.toHaveBeenCalled();
    });

    it("disappears with the AI kill switch", async () => {
      aiEnabled = false;
      await expect(service.brief(USER)).rejects.toMatchObject({
        code: ErrorCode.AI_DISABLED,
        httpStatus: HttpStatus.NOT_FOUND,
      });
    });
  });
});
