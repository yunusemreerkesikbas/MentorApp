import { HttpStatus } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { FeatureFlag } from "../../../common/config/config.catalog";
import { ErrorCode } from "../../../common/errors/error-code";
import { AiUsageFeature } from "../domain/ai.constants";
import {
  assertWithinFeatureDailyCap,
  PREMIUM_FEATURE_DAILY_GENERATION_LIMITS,
  withUserFeatureLock,
} from "./ai-generation-guard";
import { MoodReflectionService } from "./mood-reflection.service";
import { VisionNoteService } from "./vision-note.service";
import { PlanDraftService } from "./plan-draft.service";
import { AssignmentSuggestionService } from "./assignment-suggestion.service";
import { todayInIstanbul } from "../../coaching/domain/date.util";

const USER = { id: "u-guard-1", roles: ["STUDENT"] } as never;

describe("ai-generation-guard", () => {
  it("serializes concurrent calls for the same (userId, scope) and coalesces onto cache", async () => {
    let cachedReflection: string | null = null;
    let cachedLocale: string | null = null;
    let usedToday = 0;

    const complete = vi.fn(async () => {
      await new Promise((r) => setTimeout(r, 15));
      return {
        text: "Sakin bir adım at.",
        promptTokens: 10,
        completionTokens: 8,
        model: "fake",
      };
    });

    const service = new MoodReflectionService(
      { complete } as never,
      {
        build: vi.fn(async () => ({
          examType: "KPSS",
          moodLevel: 3,
          struggleNote: null,
          recentSessions: null,
          todayPlan: null,
        })),
      } as never,
      {
        append: vi.fn(async () => {
          usedToday += 1;
        }),
        countFeatureSince: vi.fn(async () => usedToday),
      } as never,
      { get: vi.fn(async (key: string) => key === FeatureFlag.AI_ENABLED) } as never,
      { assertAllowed: vi.fn(async () => undefined) } as never,
      {
        getToday: vi.fn(async () => ({
          mood: 3,
          struggleNote: null,
          aiReflection: cachedReflection,
        })),
        getTodayAiLocale: vi.fn(async () => cachedLocale),
        setTodayAiReflection: vi.fn(
          async (_uid: string, text: string, _model: string, locale: string) => {
            cachedReflection = text;
            cachedLocale = locale;
          },
        ),
      } as never,
      { assertWithinBudget: vi.fn(async () => undefined) } as never,
      { translate: vi.fn(() => "") } as never,
    );

    const results = await Promise.all([
      service.reflect(USER),
      service.reflect(USER),
      service.reflect(USER),
      service.reflect(USER),
    ]);

    // Only the first request called the LLM; the 3 concurrent followers hit the newly populated cache.
    expect(complete).toHaveBeenCalledTimes(1);
    expect(results[0]).toEqual({ reflection: "Sakin bir adım at.", model: "fake" });
    expect(results.slice(1)).toEqual([
      { reflection: "Sakin bir adım at.", model: "cache" },
      { reflection: "Sakin bir adım at.", model: "cache" },
      { reflection: "Sakin bir adım at.", model: "cache" },
    ]);
  });

  it("blocks locale-thrashing / cache-invalidation loops once the daily generation cap is reached, while keeping cache hits free", async () => {
    const cap = PREMIUM_FEATURE_DAILY_GENERATION_LIMITS[AiUsageFeature.VISION_NOTE];
    let cachedNote: string | null = null;
    let cachedLocale: string | null = null;
    const countFeatureSince = vi.fn(async () => cap);
    const complete = vi.fn();

    const service = new VisionNoteService(
      { complete } as never,
      { build: vi.fn() } as never,
      { append: vi.fn(), countFeatureSince } as never,
      { get: vi.fn(async (key: string) => key === FeatureFlag.AI_ENABLED) } as never,
      { assertAllowed: vi.fn(async () => undefined) } as never,
      {
        getMine: vi.fn(async () => ({
          goalTitle: "Atanmak",
          targetCityCode: null,
          targetCity: null,
          targetUniversityId: null,
          careerGroup: null,
          motivation: null,
          aiNote: cachedNote,
        })),
        getAiNoteLocale: vi.fn(async () => cachedLocale),
        setAiNote: vi.fn(),
        resolveTargetNames: vi.fn(),
      } as never,
      { assertWithinBudget: vi.fn() } as never,
      { translate: vi.fn() } as never,
    );

    // Cache miss when daily cap is exhausted -> 429 AI_RATE_LIMITED
    await expect(service.note(USER)).rejects.toMatchObject({
      code: ErrorCode.AI_RATE_LIMITED,
      httpStatus: HttpStatus.TOO_MANY_REQUESTS,
    });
    expect(complete).not.toHaveBeenCalled();

    // Cache hit even when daily cap is exhausted -> still 200 from cache!
    cachedNote = "Hedefin net.";
    cachedLocale = "tr";
    await expect(service.note(USER)).resolves.toEqual({
      note: "Hedefin net.",
      model: "cache",
    });
  });

  it("prevents concurrent quota bypass on PlanDraftService when 1 slot remains", async () => {
    const today = todayInIstanbul();
    let usedToday = 4; // daily_limit = 5 -> only 1 slot left
    const complete = vi.fn(async () => {
      await new Promise((r) => setTimeout(r, 15));
      return {
        text: JSON.stringify({
          days: [{ date: today, tasks: [{ title: "Tarih: 20 soru" }] }],
        }),
        promptTokens: 10,
        completionTokens: 15,
        model: "fake",
      };
    });

    const service = new PlanDraftService(
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
      {
        countFeaturesSince: vi.fn(async () => usedToday),
        append: vi.fn(async () => {
          usedToday += 1;
        }),
      } as never,
      {
        get: vi.fn(async (key: string) => {
          if (key === FeatureFlag.AI_ENABLED) return true;
          if (key === "ai.plan_draft.daily_limit") return 5;
          return null;
        }),
      } as never,
      { assertAllowed: vi.fn(async () => undefined) } as never,
      { assertWithinBudget: vi.fn(async () => undefined) } as never,
    );

    const settled = await Promise.allSettled([
      service.draft(USER),
      service.draft(USER),
      service.draft(USER),
    ]);

    const fulfilled = settled.filter((r) => r.status === "fulfilled");
    const rejected = settled.filter((r) => r.status === "rejected");
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(2);
    expect(complete).toHaveBeenCalledTimes(1);
  });

  it("caps uncached AssignmentSuggestionService daily generations even for an entitled coach", async () => {
    const cap =
      PREMIUM_FEATURE_DAILY_GENERATION_LIMITS[AiUsageFeature.MENTORSHIP_SUGGESTIONS];
    const complete = vi.fn();
    const service = new AssignmentSuggestionService(
      { complete } as never,
      { get: vi.fn(async () => true) } as never,
      {
        append: vi.fn(),
        countFeatureSince: vi.fn(async () => cap),
      } as never,
      { assertWithinBudget: vi.fn() } as never,
      { assertAllowed: vi.fn(async () => undefined) } as never,
    );

    await expect(
      service.suggest({} as never, { id: "coach-1", roles: ["COACH"] }, "tr"),
    ).rejects.toMatchObject({
      code: ErrorCode.MENTORSHIP_AI_DAILY_LIMIT,
      httpStatus: HttpStatus.FORBIDDEN,
    });
    expect(complete).not.toHaveBeenCalled();
  });

  it("releases the per-user lock after an error so subsequent calls are not deadlocked", async () => {
    await expect(
      withUserFeatureLock("u-err", "test", async () => {
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");

    await expect(
      withUserFeatureLock("u-err", "test", async () => "recovered"),
    ).resolves.toBe("recovered");
  });

  it("assertWithinFeatureDailyCap throws when usage reaches the feature cap", async () => {
    await expect(
      assertWithinFeatureDailyCap(
        { countFeatureSince: vi.fn(async () => 10) },
        "u1",
        AiUsageFeature.MOOD,
      ),
    ).rejects.toMatchObject({
      code: ErrorCode.AI_RATE_LIMITED,
      httpStatus: HttpStatus.TOO_MANY_REQUESTS,
    });
  });
});
