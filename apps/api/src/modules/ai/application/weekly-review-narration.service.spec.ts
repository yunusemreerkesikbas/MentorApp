import { HttpStatus } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FeatureFlag } from "../../../common/config/config.catalog";
import { ErrorCode } from "../../../common/errors/error-code";
import {
  buildWeeklyReviewNarrationEvidence,
  WEEKLY_REVIEW_PROMPT_VERSION,
} from "../domain/weekly-review-prompt";
import { WeeklyReviewNarrationService } from "./weekly-review-narration.service";

const USER = { id: "u1", roles: ["STUDENT"] } as never;
const evidence = {
  review: {
    period: {
      startDate: "2026-06-29",
      endDate: "2026-07-05",
      timeZone: "Europe/Istanbul",
    },
    status: "READY",
    recap: {
      status: "READY",
      activeDays: 2,
      weeklyTitle: {
        id: "PLAN_ARCHITECT",
        label: "Rota Mimarı",
        message: "Tamamladığın üç görevle haftanın rotasını çizdin.",
      },
      nextStorySignal: null,
      nextStorySignals: [],
      closingMessage: "Yanındayım.",
    },
    evidence: {
      mockExamCount: 1,
      completedSessionCount: 0,
      qualifyingSessionCount: 0,
      completedPlanTaskCount: 3,
    },
    rhythm: {
      completedSessionCount: 0,
      focusMinutes: 0,
      activeDays: 0,
      longestSessionMinutes: 0,
      longestActiveRun: 2,
      focusTimeBand: null,
      peakFocusDay: null,
      days: [
        { date: "2026-06-29", active: true },
        { date: "2026-06-30", active: true },
        { date: "2026-07-01", active: false },
        { date: "2026-07-02", active: false },
        { date: "2026-07-03", active: false },
        { date: "2026-07-04", active: false },
        { date: "2026-07-05", active: false },
      ],
      subjectBreakdown: [],
      moodCheckinCount: 1,
      energySignal: "MIXED",
      message: "Ritim",
    },
    plan: {
      completedTaskCount: 3,
      subjectBreakdown: [
        { subjectRef: "turkce", subjectName: "Türkçe", completedTaskCount: 2 },
      ],
      message: "Üç görev tamamlandı.",
    },
    highlights: [
      {
        kind: "COMPLETED_TASKS",
        completedTaskCount: 3,
        message: "Üç küçük adım.",
      },
    ],
    performance: {
      mockExamCount: 1,
      averageNet: "70.00",
      previousWeekAverageNet: "68.00",
      delta: "+2.00",
      evidenceLevel: "COMPARABLE",
      message: "Gelişim",
    },
    focus: {
      source: "WEEKLY_DECLINE",
      subjectRef: "turkce",
      subjectName: "Türkçe",
      message: "Odak",
    },
    suggestedTask: { title: "Türkçe haftalık tekrar", subject: "Türkçe" },
  },
  suggestedTask: { subjectRef: "turkce", title: "Türkçe haftalık tekrar" },
  fingerprintInput: {
    aggregate: true,
    sessionUpdated: [
      ["session-previous", "2026-06-28T12:00:00.000Z"],
      ["session-current", "2026-07-01T12:00:00.000Z"],
    ],
    taskUpdated: [["task-1", "DONE", "2026-06-30", "2026-06-30T12:00:00.000Z"]],
  },
} as const;

describe("WeeklyReviewNarrationService", () => {
  let complete: ReturnType<typeof vi.fn>;
  let getEntitlement: ReturnType<typeof vi.fn>;
  let isUnlocked: ReturnType<typeof vi.fn>;
  let economyEnabled: boolean;
  let find: ReturnType<typeof vi.fn>;
  let upsert: ReturnType<typeof vi.fn>;
  let currentEvidence: typeof evidence;
  let service: WeeklyReviewNarrationService;

  it("uses the wrapped-title prompt version", () => {
    expect(WEEKLY_REVIEW_PROMPT_VERSION).toBe("v7");
  });

  beforeEach(() => {
    complete = vi.fn(async () => ({
      text: "İyi bir hafta.",
      model: "fake",
      promptTokens: 4,
      completionTokens: 3,
    }));
    getEntitlement = vi.fn(async () => ({ isPremium: true }));
    isUnlocked = vi.fn(async () => false);
    economyEnabled = false;
    find = vi.fn(async () => undefined);
    upsert = vi.fn(async () => undefined);
    currentEvidence = evidence;
    service = new WeeklyReviewNarrationService(
      { complete } as never,
      {
        get: vi.fn(async (key: string) =>
          key === FeatureFlag.AI_ENABLED
            ? true
            : key === "economy.enabled"
              ? economyEnabled
              : false,
        ),
      } as never,
      { getEntitlement } as never,
      { isUnlocked } as never,
      { getAiEvidence: vi.fn(async () => currentEvidence) } as never,
      { find, upsert } as never,
      { append: vi.fn(async () => undefined) } as never,
      { assertWithinBudget: vi.fn(async () => undefined) } as never,
      { isAllowed: vi.fn(async () => false) } as never,
    );
  });

  it("blocks free users before any LLM call", async () => {
    getEntitlement.mockResolvedValue({ isPremium: false });
    await expect(
      service.narrate(USER, "00000000-0000-4000-8000-000000000001"),
    ).rejects.toMatchObject({
      code: ErrorCode.PAYMENT_PREMIUM_REQUIRED,
      httpStatus: HttpStatus.FORBIDDEN,
    });
    expect(complete).not.toHaveBeenCalled();
  });

  it("lets a free user through with a deep-analysis unlock for this exam+week", async () => {
    getEntitlement.mockResolvedValue({ isPremium: false });
    economyEnabled = true;
    isUnlocked.mockResolvedValue(true);

    const result = await service.narrate(
      USER,
      "00000000-0000-4000-8000-000000000001",
    );

    expect(result.narration).toBe("İyi bir hafta.");
    expect(isUnlocked).toHaveBeenCalledWith(
      "u1",
      "00000000-0000-4000-8000-000000000001",
      "2026-06-29",
    );
  });

  it("still blocks a free user with an unlock while the economy flag is off", async () => {
    getEntitlement.mockResolvedValue({ isPremium: false });
    economyEnabled = false;
    isUnlocked.mockResolvedValue(true);

    await expect(
      service.narrate(USER, "00000000-0000-4000-8000-000000000001"),
    ).rejects.toMatchObject({
      code: ErrorCode.PAYMENT_PREMIUM_REQUIRED,
    });
  });

  it("never consults the unlock for premium users", async () => {
    await service.narrate(USER, "00000000-0000-4000-8000-000000000001");
    expect(isUnlocked).not.toHaveBeenCalled();
  });

  it("reuses a matching fingerprint cache", async () => {
    await service.narrate(USER, "00000000-0000-4000-8000-000000000001");
    const saved = upsert.mock.calls[0]![0] as { sourceFingerprint: string };
    find.mockResolvedValue({
      sourceFingerprint: saved.sourceFingerprint,
      narration: "Önbellek",
    });
    complete.mockClear();

    const result = await service.narrate(
      USER,
      "00000000-0000-4000-8000-000000000001",
    );

    expect(result).toMatchObject({ narration: "Önbellek", model: "cache" });
    expect(complete).not.toHaveBeenCalled();
  });

  it("invalidates the cache when a plan task changes", async () => {
    await service.narrate(USER, "00000000-0000-4000-8000-000000000001");
    const saved = upsert.mock.calls[0]![0] as {
      sourceFingerprint: string;
    };
    find.mockResolvedValue({
      sourceFingerprint: saved.sourceFingerprint,
      narration: "Old narration",
    });
    currentEvidence = {
      ...evidence,
      fingerprintInput: {
        ...evidence.fingerprintInput,
        taskUpdated: [
          ["task-1", "DONE", "2026-07-01", "2026-07-01T12:00:00.000Z"],
        ],
      },
    } as typeof evidence;
    complete.mockClear();

    await service.narrate(USER, "00000000-0000-4000-8000-000000000001");

    expect(complete).toHaveBeenCalledOnce();
  });

  it("invalidates the cache when previous-week session evidence changes", async () => {
    await service.narrate(USER, "00000000-0000-4000-8000-000000000001");
    const saved = upsert.mock.calls[0]![0] as {
      sourceFingerprint: string;
    };
    find.mockResolvedValue({
      sourceFingerprint: saved.sourceFingerprint,
      narration: "Old narration",
    });
    currentEvidence = {
      ...evidence,
      fingerprintInput: {
        ...evidence.fingerprintInput,
        sessionUpdated: [
          ["session-previous", "2026-06-28T13:00:00.000Z"],
          ["session-current", "2026-07-01T12:00:00.000Z"],
        ],
      },
    } as typeof evidence;
    complete.mockClear();

    await service.narrate(USER, "00000000-0000-4000-8000-000000000001");

    expect(complete).toHaveBeenCalledOnce();
  });

  it("narrates a tasks-only READY review from aggregate plan evidence", async () => {
    currentEvidence = {
      ...evidence,
      review: {
        ...evidence.review,
        recap: {
          ...evidence.review.recap,
          status: "READY",
        },
        evidence: {
          mockExamCount: 0,
          completedSessionCount: 0,
          qualifyingSessionCount: 0,
          completedPlanTaskCount: 3,
        },
        performance: null,
        focus: null,
      },
    } as unknown as typeof evidence;

    await service.narrate(USER, "00000000-0000-4000-8000-000000000001");

    const prompt = complete.mock.calls[0]![0] as { user: string };
    expect(prompt.user).toContain('"completedTaskCount":3');
    expect(prompt.user).toContain('"mockExamCount":0');
    expect(prompt.user).toContain('"performance":null');
  });

  it("sends aggregate plan evidence without raw notes or task-title fields", async () => {
    await service.narrate(USER, "00000000-0000-4000-8000-000000000001");
    const prompt = complete.mock.calls[0]![0] as {
      system: string;
      user: string;
    };
    expect(prompt.user).toContain('"completedTaskCount":3');
    expect(prompt.user).toContain('"subjectBreakdown"');
    expect(prompt.user).toContain('"id":"PLAN_ARCHITECT"');
    expect(prompt.user).toContain('"kind":"COMPLETED_TASKS"');
    expect(prompt.user).toContain('"editorialFrame":"construction"');
    expect(prompt.system).toContain("three-beat");
    expect(prompt.system).toContain("supplied weekly character");
    expect(prompt.system).toContain("Never select");
    expect(prompt.user).not.toContain('"period"');
    expect(prompt.user).not.toContain("closingMessage");
    expect(prompt.user).not.toContain("energySignal");
    expect(prompt.user).not.toContain("struggleNote");
    expect(prompt.user).not.toContain("moodNote");
    expect(prompt.user).not.toContain("taskTitle");
  });

  it("builds a compact narration evidence object with the new weekly data stories", () => {
    const input = {
      ...evidence.review,
      rhythm: {
        ...evidence.review.rhythm,
        focusTimeBand: {
          id: "MORNING" as const,
          label: "Sabah modu",
          focusMinutes: 45,
          qualifyingSessionCount: 2,
          message: "Sabah modu öne çıktı.",
        },
        peakFocusDay: {
          date: "2026-06-30",
          focusMinutes: 30,
          message: "Salı güç günüydü.",
        },
      },
    };

    expect(buildWeeklyReviewNarrationEvidence(input)).toMatchObject({
      editorialFrame: "construction",
      weeklyTitle: { id: "PLAN_ARCHITECT" },
      rhythm: {
        focusTimeBand: { id: "MORNING", focusMinutes: 45 },
        peakFocusDay: { date: "2026-06-30", focusMinutes: 30 },
      },
      nextStep: "Odak",
    });
  });
});
