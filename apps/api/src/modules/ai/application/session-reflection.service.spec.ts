import { HttpStatus } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FeatureFlag } from "../../../common/config/config.catalog";
import { ErrorCode } from "../../../common/errors/error-code";
import { SessionReflectionService } from "./session-reflection.service";

const USER_ID = "u1";
const SESSION_ID = "11111111-1111-1111-1111-111111111111";
const USER = { id: USER_ID, roles: ["STUDENT"] } as never;

function baseSession(overrides: Record<string, unknown> = {}) {
  return {
    id: SESSION_ID,
    endedAt: "2026-07-09T01:00:00.000Z",
    actualFocusSeconds: 1500,
    subject: "Matematik",
    sessionMood: 2,
    struggleNote: null,
    aiReflection: null,
    ...overrides,
  };
}

describe("SessionReflectionService", () => {
  let complete: ReturnType<typeof vi.fn>;
  let build: ReturnType<typeof vi.fn>;
  let append: ReturnType<typeof vi.fn>;
  let configGet: ReturnType<typeof vi.fn>;
  let getEntitlement: ReturnType<typeof vi.fn>;
  let getById: ReturnType<typeof vi.fn>;
  let setAiReflection: ReturnType<typeof vi.fn>;
  let service: SessionReflectionService;

  beforeEach(() => {
    complete = vi.fn(async () => ({
      text: "Güzel bir seans oldu; yarın aynı ritmi koru.",
      promptTokens: 12,
      completionTokens: 10,
      model: "fake",
    }));
    build = vi.fn(async () => ({
      examType: "KPSS",
      daysRemaining: 100,
      examDateLabel: null,
      moodLevel: null,
      struggleNote: null,
      recentSessions: null,
    }));
    append = vi.fn(async () => undefined);
    configGet = vi.fn(async (key: string) => (key === FeatureFlag.AI_ENABLED ? true : null));
    getEntitlement = vi.fn(async () => ({ isPremium: true }));
    getById = vi.fn(async () => baseSession());
    setAiReflection = vi.fn(async () => baseSession({ aiReflection: "Güzel bir seans oldu; yarın aynı ritmi koru." }));

    service = new SessionReflectionService(
      { complete } as never,
      { build } as never,
      { append } as never,
      { get: configGet } as never,
      { getEntitlement } as never,
      { getById, setAiReflection } as never,
    );
  });

  it("throws AI_DISABLED when the global AI flag is off", async () => {
    configGet.mockResolvedValue(false);
    await expect(service.reflect(USER, SESSION_ID)).rejects.toMatchObject({
      code: ErrorCode.AI_DISABLED,
      httpStatus: HttpStatus.NOT_FOUND,
    });
  });

  it("throws PAYMENT_PREMIUM_REQUIRED for free users", async () => {
    getEntitlement.mockResolvedValue({ isPremium: false });
    await expect(service.reflect(USER, SESSION_ID)).rejects.toMatchObject({
      code: ErrorCode.PAYMENT_PREMIUM_REQUIRED,
      httpStatus: HttpStatus.FORBIDDEN,
    });
    expect(complete).not.toHaveBeenCalled();
  });

  it("throws when the session is missing", async () => {
    getById.mockResolvedValue(null);
    await expect(service.reflect(USER, SESSION_ID)).rejects.toMatchObject({
      code: ErrorCode.COACHING_SESSION_NOT_FOUND,
      httpStatus: HttpStatus.NOT_FOUND,
    });
  });

  it("throws when micro check-in mood is missing", async () => {
    getById.mockResolvedValue(baseSession({ sessionMood: null }));
    await expect(service.reflect(USER, SESSION_ID)).rejects.toMatchObject({
      httpStatus: HttpStatus.BAD_REQUEST,
    });
    expect(complete).not.toHaveBeenCalled();
  });

  it("returns the cached reflection without calling the LLM", async () => {
    getById.mockResolvedValue(baseSession({ aiReflection: "Önceki seans yansıması." }));
    const res = await service.reflect(USER, SESSION_ID);
    expect(res).toEqual({ reflection: "Önceki seans yansıması.", model: "cache" });
    expect(complete).not.toHaveBeenCalled();
    expect(setAiReflection).not.toHaveBeenCalled();
  });

  it("generates, meters and caches a reflection for premium", async () => {
    const res = await service.reflect(USER, SESSION_ID);
    expect(res.reflection).toBe("Güzel bir seans oldu; yarın aynı ritmi koru.");
    expect(res.model).toBe("fake");
    expect(append).toHaveBeenCalledOnce();
    expect(setAiReflection).toHaveBeenCalledWith(
      USER_ID,
      SESSION_ID,
      "Güzel bir seans oldu; yarın aynı ritmi koru.",
      "fake",
    );
  });
});
