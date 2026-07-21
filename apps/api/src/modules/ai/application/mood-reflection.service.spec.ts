import { HttpStatus } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FeatureFlag } from "../../../common/config/config.catalog";
import { ErrorCode } from "../../../common/errors/error-code";
import { MoodReflectionService } from "./mood-reflection.service";

const USER_ID = "u1";
const USER = { id: USER_ID, roles: ["STUDENT"] } as never;
const SAFETY_MESSAGE = "Bunu tek başına taşımak zorunda değilsin.";

describe("MoodReflectionService", () => {
  let complete: ReturnType<typeof vi.fn>;
  let build: ReturnType<typeof vi.fn>;
  let append: ReturnType<typeof vi.fn>;
  let configGet: ReturnType<typeof vi.fn>;
  let getEntitlement: ReturnType<typeof vi.fn>;
  let getToday: ReturnType<typeof vi.fn>;
  let setTodayAiReflection: ReturnType<typeof vi.fn>;
  let assertWithinBudget: ReturnType<typeof vi.fn>;
  let translate: ReturnType<typeof vi.fn>;
  let service: MoodReflectionService;

  beforeEach(() => {
    complete = vi.fn(async () => ({
      text: "Bugün küçük bir adım at.",
      promptTokens: 10,
      completionTokens: 8,
      model: "fake",
    }));
    build = vi.fn(async () => ({
      examType: "KPSS",
      moodLevel: 2,
      struggleNote: null,
      recentSessions: null,
      todayPlan: null,
    }));
    append = vi.fn(async () => undefined);
    configGet = vi.fn(async (key: string) =>
      key === FeatureFlag.AI_ENABLED ? true : null,
    );
    getEntitlement = vi.fn(async () => ({ isPremium: true }));
    getToday = vi.fn(async () => ({
      mood: 2,
      struggleNote: null,
      aiReflection: null,
    }));
    setTodayAiReflection = vi.fn(async () => undefined);
    assertWithinBudget = vi.fn(async () => undefined);
    translate = vi.fn(() => SAFETY_MESSAGE);

    service = new MoodReflectionService(
      { complete } as never,
      { build } as never,
      { append } as never,
      { get: configGet } as never,
      { getEntitlement } as never,
      { getToday, setTodayAiReflection } as never,
      { assertWithinBudget } as never,
      { translate } as never,
    );
  });

  it("throws AI_DISABLED when the global AI flag is off", async () => {
    configGet.mockResolvedValue(false);
    await expect(service.reflect(USER)).rejects.toMatchObject({
      code: ErrorCode.AI_DISABLED,
      httpStatus: HttpStatus.NOT_FOUND,
    });
  });

  it("throws PAYMENT_PREMIUM_REQUIRED for free users (premium-only §4 #5)", async () => {
    getEntitlement.mockResolvedValue({ isPremium: false });
    await expect(service.reflect(USER)).rejects.toMatchObject({
      code: ErrorCode.PAYMENT_PREMIUM_REQUIRED,
      httpStatus: HttpStatus.FORBIDDEN,
    });
    expect(complete).not.toHaveBeenCalled();
  });

  it("throws when there is no mood check-in yet today", async () => {
    getToday.mockResolvedValue(null);
    await expect(service.reflect(USER)).rejects.toMatchObject({
      httpStatus: HttpStatus.BAD_REQUEST,
    });
  });

  it("returns the cached reflection without calling the LLM", async () => {
    getToday.mockResolvedValue({
      mood: 3,
      struggleNote: null,
      aiReflection: "Önceki yansıma.",
    });
    const res = await service.reflect(USER);
    expect(res).toEqual({ reflection: "Önceki yansıma.", model: "cache" });
    expect(complete).not.toHaveBeenCalled();
    expect(setTodayAiReflection).not.toHaveBeenCalled();
  });

  it("returns localized deterministic support before cache or LLM for serious distress", async () => {
    getToday.mockResolvedValue({
      mood: 1,
      struggleNote: "Hiçbir şeyin anlamı yok gibi hissediyorum.",
      aiReflection: "Eski ve uygunsuz cache.",
    });

    await expect(service.reflect(USER)).resolves.toEqual({
      reflection: SAFETY_MESSAGE,
      model: "safety",
    });
    expect(translate).toHaveBeenCalledWith("coaching.mood.SERIOUS_DISTRESS", {
      lang: undefined,
    });
    expect(build).not.toHaveBeenCalled();
    expect(assertWithinBudget).not.toHaveBeenCalled();
    expect(complete).not.toHaveBeenCalled();
    expect(append).not.toHaveBeenCalled();
    expect(setTodayAiReflection).not.toHaveBeenCalled();
  });

  it("generates, meters and caches a reflection for premium with an uncached mood", async () => {
    const res = await service.reflect(USER);
    expect(res.reflection).toBe("Bugün küçük bir adım at.");
    expect(res.model).toBe("fake");
    expect(append).toHaveBeenCalledOnce();
    expect(setTodayAiReflection).toHaveBeenCalledWith(
      USER_ID,
      "Bugün küçük bir adım at.",
      "fake",
    );
  });
});
