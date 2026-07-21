import { HttpStatus } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FeatureFlag } from "../../../common/config/config.catalog";
import { ErrorCode } from "../../../common/errors/error-code";
import { AiUsageFeature } from "../domain/ai.constants";
import { PlanDraftService } from "./plan-draft.service";

const USER = { id: "u1", roles: ["STUDENT"] } as never;
const TODAY = new Date().toISOString().slice(0, 10);

describe("PlanDraftService", () => {
  let complete: ReturnType<typeof vi.fn>;
  let append: ReturnType<typeof vi.fn>;
  let configGet: ReturnType<typeof vi.fn>;
  let getEntitlement: ReturnType<typeof vi.fn>;
  let countFeaturesSince: ReturnType<typeof vi.fn>;
  let service: PlanDraftService;

  beforeEach(() => {
    complete = vi.fn(async () => ({
      text: JSON.stringify({
        days: [
          {
            date: TODAY,
            tasks: [{ title: "Matematik: 20 soru", subject: "Matematik" }],
          },
        ],
      }),
      promptTokens: 10,
      completionTokens: 20,
      model: "fake",
    }));
    append = vi.fn(async () => undefined);
    configGet = vi.fn(async (key: string) => {
      if (key === FeatureFlag.AI_ENABLED) return true;
      if (key === "ai.plan_draft.daily_limit") return 5;
      return null;
    });
    getEntitlement = vi.fn(async () => ({ isPremium: true }));
    countFeaturesSince = vi.fn(async () => 0);

    service = new PlanDraftService(
      { complete } as never,
      {
        build: vi.fn(async () => ({
          examType: "KPSS",
          moodLevel: null,
          struggleNote: null,
          recentSessions: null,
          todayPlan: null,
        })),
      } as never,
      { append, countFeaturesSince } as never,
      { get: configGet } as never,
      { getEntitlement } as never,
      { assertWithinBudget: vi.fn(async () => undefined) } as never,
    );
  });

  it("throws PAYMENT_PREMIUM_REQUIRED for free users (premium-only §4 #5)", async () => {
    getEntitlement.mockResolvedValue({ isPremium: false });
    await expect(service.draft(USER)).rejects.toMatchObject({
      code: ErrorCode.PAYMENT_PREMIUM_REQUIRED,
      httpStatus: HttpStatus.FORBIDDEN,
    });
    expect(complete).not.toHaveBeenCalled();
  });

  it("throws AI_RATE_LIMITED when the per-feature daily cap is reached", async () => {
    countFeaturesSince.mockResolvedValue(5);
    await expect(service.draft(USER)).rejects.toMatchObject({
      code: ErrorCode.AI_RATE_LIMITED,
      httpStatus: HttpStatus.TOO_MANY_REQUESTS,
    });
    expect(complete).not.toHaveBeenCalled();
  });

  it("meters the call even when the output is unparseable, then 503s", async () => {
    complete.mockResolvedValue({
      text: "plan yapamadım",
      promptTokens: 5,
      completionTokens: 3,
      model: "fake",
    });
    await expect(service.draft(USER)).rejects.toMatchObject({
      code: ErrorCode.AI_PROVIDER_ERROR,
      httpStatus: HttpStatus.SERVICE_UNAVAILABLE,
    });
    expect(append).toHaveBeenCalledOnce();
  });

  it("returns the clamped draft and meters with the plan_draft feature", async () => {
    const res = await service.draft(USER, "hafta sonu yoğunum");
    expect(res.model).toBe("fake");
    expect(res.days).toEqual([
      {
        date: TODAY,
        tasks: [{ title: "Matematik: 20 soru", subject: "Matematik" }],
      },
    ]);
    expect(append.mock.calls[0][0].feature).toBe(AiUsageFeature.PLAN_DRAFT);
    // The user's wish reaches the prompt.
    expect(complete.mock.calls[0][0].user).toContain("hafta sonu yoğunum");
  });
});
