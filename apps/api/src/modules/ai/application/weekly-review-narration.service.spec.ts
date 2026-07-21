import { HttpStatus } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FeatureFlag } from "../../../common/config/config.catalog";
import { ErrorCode } from "../../../common/errors/error-code";
import { WeeklyReviewNarrationService } from "./weekly-review-narration.service";

const USER = { id: "u1", roles: ["STUDENT"] } as never;
const evidence = {
  review: {
    period: { startDate: "2026-06-29", endDate: "2026-07-05", timeZone: "Europe/Istanbul" },
    status: "READY",
    evidence: { mockExamCount: 1, completedSessionCount: 0 },
    rhythm: { completedSessionCount: 0, focusMinutes: 0, activeDays: 0, moodCheckinCount: 1, energySignal: "MIXED", message: "Ritim" },
    performance: { mockExamCount: 1, averageNet: "70.00", previousWeekAverageNet: "68.00", delta: "+2.00", evidenceLevel: "COMPARABLE", message: "Gelişim" },
    focus: { source: "WEEKLY_DECLINE", subjectRef: "turkce", subjectName: "Türkçe", message: "Odak" },
  },
  suggestedTask: { subjectRef: "turkce", title: "Türkçe haftalık tekrar" },
  fingerprintInput: { aggregate: true },
} as const;

describe("WeeklyReviewNarrationService", () => {
  let complete: ReturnType<typeof vi.fn>;
  let getEntitlement: ReturnType<typeof vi.fn>;
  let isUnlocked: ReturnType<typeof vi.fn>;
  let economyEnabled: boolean;
  let find: ReturnType<typeof vi.fn>;
  let upsert: ReturnType<typeof vi.fn>;
  let service: WeeklyReviewNarrationService;

  beforeEach(() => {
    complete = vi.fn(async () => ({ text: "İyi bir hafta.", model: "fake", promptTokens: 4, completionTokens: 3 }));
    getEntitlement = vi.fn(async () => ({ isPremium: true }));
    isUnlocked = vi.fn(async () => false);
    economyEnabled = false;
    find = vi.fn(async () => undefined);
    upsert = vi.fn(async () => undefined);
    service = new WeeklyReviewNarrationService(
      { complete } as never,
      {
        get: vi.fn(async (key: string) =>
          key === FeatureFlag.AI_ENABLED ? true : key === "economy.enabled" ? economyEnabled : false,
        ),
      } as never,
      { getEntitlement } as never,
      { isUnlocked } as never,
      { getAiEvidence: vi.fn(async () => evidence) } as never,
      { find, upsert } as never,
      { append: vi.fn(async () => undefined) } as never,
      { assertWithinBudget: vi.fn(async () => undefined) } as never,
    );
  });

  it("blocks free users before any LLM call", async () => {
    getEntitlement.mockResolvedValue({ isPremium: false });
    await expect(service.narrate(USER, "00000000-0000-4000-8000-000000000001")).rejects.toMatchObject({
      code: ErrorCode.PAYMENT_PREMIUM_REQUIRED,
      httpStatus: HttpStatus.FORBIDDEN,
    });
    expect(complete).not.toHaveBeenCalled();
  });

  it("lets a free user through with a deep-analysis unlock for this exam+week", async () => {
    getEntitlement.mockResolvedValue({ isPremium: false });
    economyEnabled = true;
    isUnlocked.mockResolvedValue(true);

    const result = await service.narrate(USER, "00000000-0000-4000-8000-000000000001");

    expect(result.narration).toBe("İyi bir hafta.");
    expect(isUnlocked).toHaveBeenCalledWith("u1", "00000000-0000-4000-8000-000000000001", "2026-06-29");
  });

  it("still blocks a free user with an unlock while the economy flag is off", async () => {
    getEntitlement.mockResolvedValue({ isPremium: false });
    economyEnabled = false;
    isUnlocked.mockResolvedValue(true);

    await expect(service.narrate(USER, "00000000-0000-4000-8000-000000000001")).rejects.toMatchObject({
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
    find.mockResolvedValue({ sourceFingerprint: saved.sourceFingerprint, narration: "Önbellek" });
    complete.mockClear();

    const result = await service.narrate(USER, "00000000-0000-4000-8000-000000000001");

    expect(result).toMatchObject({ narration: "Önbellek", model: "cache" });
    expect(complete).not.toHaveBeenCalled();
  });

  it("sends only the aggregate review to the LLM", async () => {
    await service.narrate(USER, "00000000-0000-4000-8000-000000000001");
    const prompt = complete.mock.calls[0]![0] as { user: string };
    expect(prompt.user).not.toContain("struggleNote");
  });
});

