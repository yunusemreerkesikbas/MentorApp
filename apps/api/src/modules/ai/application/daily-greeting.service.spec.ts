import { HttpStatus } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FeatureFlag } from "../../../common/config/config.catalog";
import { ErrorCode } from "../../../common/errors/error-code";
import { AiUsageFeature } from "../domain/ai.constants";
import { DailyGreetingService } from "./daily-greeting.service";

const USER_ID = "u1";
const USER = { id: USER_ID, roles: ["STUDENT"] } as never;

describe("DailyGreetingService", () => {
  let complete: ReturnType<typeof vi.fn>;
  let build: ReturnType<typeof vi.fn>;
  let append: ReturnType<typeof vi.fn>;
  let configGet: ReturnType<typeof vi.fn>;
  let getEntitlement: ReturnType<typeof vi.fn>;
  let find: ReturnType<typeof vi.fn>;
  let insert: ReturnType<typeof vi.fn>;
  let service: DailyGreetingService;

  beforeEach(() => {
    complete = vi.fn(async () => ({
      text: "Günaydın! Bugün tek küçük adım yeter.",
      promptTokens: 12,
      completionTokens: 9,
      model: "fake",
    }));
    build = vi.fn(async () => ({
      examType: "KPSS",
      moodLevel: null,
      struggleNote: null,
      recentSessions: null,
      todayPlan: null,
    }));
    append = vi.fn(async () => undefined);
    configGet = vi.fn(async (key: string) =>
      key === FeatureFlag.AI_ENABLED ? true : null,
    );
    getEntitlement = vi.fn(async () => ({ isPremium: true }));
    find = vi.fn(async () => undefined);
    insert = vi.fn(async () => undefined);

    service = new DailyGreetingService(
      { complete } as never,
      { build } as never,
      { append } as never,
      { get: configGet } as never,
      { getEntitlement } as never,
      { find, insert } as never,
      { assertWithinBudget: vi.fn(async () => undefined) } as never,
    );
  });

  it("throws AI_DISABLED when the global AI flag is off", async () => {
    configGet.mockResolvedValue(false);
    await expect(service.greet(USER)).rejects.toMatchObject({
      code: ErrorCode.AI_DISABLED,
      httpStatus: HttpStatus.NOT_FOUND,
    });
  });

  it("throws PAYMENT_PREMIUM_REQUIRED for free users (premium-only §4 #5)", async () => {
    getEntitlement.mockResolvedValue({ isPremium: false });
    await expect(service.greet(USER)).rejects.toMatchObject({
      code: ErrorCode.PAYMENT_PREMIUM_REQUIRED,
      httpStatus: HttpStatus.FORBIDDEN,
    });
    expect(complete).not.toHaveBeenCalled();
  });

  it("returns the cached greeting without calling the LLM", async () => {
    find.mockResolvedValue({ greeting: "Önceki selam.", model: "fake" });
    const res = await service.greet(USER);
    expect(res).toEqual({ greeting: "Önceki selam.", model: "cache" });
    expect(complete).not.toHaveBeenCalled();
    expect(insert).not.toHaveBeenCalled();
  });

  it("generates, meters and caches a greeting on a fresh day", async () => {
    const res = await service.greet(USER);
    expect(res.greeting).toBe("Günaydın! Bugün tek küçük adım yeter.");
    expect(res.model).toBe("fake");
    expect(append).toHaveBeenCalledOnce();
    expect(append.mock.calls[0][0].feature).toBe(AiUsageFeature.DAILY_GREETING);
    expect(insert).toHaveBeenCalledWith({
      userId: USER_ID,
      greetingDate: new Date().toISOString().slice(0, 10),
      greeting: "Günaydın! Bugün tek küçük adım yeter.",
      model: "fake",
    });
  });
});
