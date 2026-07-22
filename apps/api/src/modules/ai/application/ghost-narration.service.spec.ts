import { HttpStatus } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FeatureFlag } from "../../../common/config/config.catalog";
import { ErrorCode } from "../../../common/errors/error-code";
import { GhostNarrationService } from "./ghost-narration.service";

const USER_ID = "u1";
const USER = { id: USER_ID, roles: ["STUDENT"] } as never;

const ghostFixture = (aiNarration: string | null = null) => ({
  latest: { id: "m2", takenAt: "2026-06-19T10:00:00.000Z", totalNet: "42.00", examName: "KPSS" },
  previousNet: "39.00",
  previousDelta: "+3.00",
  beatPrevious: true,
  bestPreviousNet: "40.00",
  recordDelta: "+2.00",
  isNewRecord: true,
  headline: "Yeni rekor!",
  subjects: [],
  aiNarration,
});

describe("GhostNarrationService", () => {
  let complete: ReturnType<typeof vi.fn>;
  let append: ReturnType<typeof vi.fn>;
  let configGet: ReturnType<typeof vi.fn>;
  let getEntitlement: ReturnType<typeof vi.fn>;
  let getGhostComparison: ReturnType<typeof vi.fn>;
  let setLatestGhostNarration: ReturnType<typeof vi.fn>;
  let getLatestGhostNarrationLocale: ReturnType<typeof vi.fn>;
  let service: GhostNarrationService;

  beforeEach(() => {
    complete = vi.fn(async () => ({
      text: "Geçmiş-ben'i geçtin, harika ivme!",
      promptTokens: 10,
      completionTokens: 8,
      model: "fake",
    }));
    append = vi.fn(async () => undefined);
    configGet = vi.fn(async (key: string) => (key === FeatureFlag.AI_ENABLED ? true : null));
    getEntitlement = vi.fn(async () => ({ isPremium: true }));
    getGhostComparison = vi.fn(async () => ghostFixture());
    setLatestGhostNarration = vi.fn(async () => undefined);
    getLatestGhostNarrationLocale = vi.fn(async () => null);

    service = new GhostNarrationService(
      { complete } as never,
      { append } as never,
      { get: configGet } as never,
      { getEntitlement } as never,
      {
        getGhostComparison,
        getLatestGhostNarrationLocale,
        setLatestGhostNarration,
      } as never,
      { assertWithinBudget: vi.fn(async () => undefined) } as never,
    );
  });

  it("throws AI_DISABLED when the global AI flag is off", async () => {
    configGet.mockResolvedValue(false);
    await expect(service.narrate(USER)).rejects.toMatchObject({
      code: ErrorCode.AI_DISABLED,
      httpStatus: HttpStatus.NOT_FOUND,
    });
  });

  it("throws PAYMENT_PREMIUM_REQUIRED for free users (premium-only §4 #5)", async () => {
    getEntitlement.mockResolvedValue({ isPremium: false });
    await expect(service.narrate(USER)).rejects.toMatchObject({
      code: ErrorCode.PAYMENT_PREMIUM_REQUIRED,
      httpStatus: HttpStatus.FORBIDDEN,
    });
    expect(complete).not.toHaveBeenCalled();
  });

  it("throws 400 when there are fewer than two attempts (no ghost)", async () => {
    getGhostComparison.mockResolvedValue(null);
    await expect(service.narrate(USER)).rejects.toMatchObject({
      httpStatus: HttpStatus.BAD_REQUEST,
    });
  });

  it("returns the cached narration without calling the LLM", async () => {
    getLatestGhostNarrationLocale.mockResolvedValue("tr");
    getGhostComparison.mockResolvedValue(ghostFixture("Önceki anlatım."));
    const res = await service.narrate(USER);
    expect(res).toEqual({ narration: "Önceki anlatım.", model: "cache" });
    expect(complete).not.toHaveBeenCalled();
    expect(setLatestGhostNarration).not.toHaveBeenCalled();
  });

  it("regenerates a cached narration when its locale differs", async () => {
    getLatestGhostNarrationLocale.mockResolvedValue("en");
    getGhostComparison.mockResolvedValue(ghostFixture("Cached in English."));

    await service.narrate(USER);

    expect(complete).toHaveBeenCalledOnce();
  });

  it("generates, meters and caches a narration within the requested exam", async () => {
    const examId = "11111111-1111-4111-8111-111111111111";
    const res = await service.narrate(USER, examId);
    expect(res.narration).toBe("Geçmiş-ben'i geçtin, harika ivme!");
    expect(res.model).toBe("fake");
    expect(append).toHaveBeenCalledOnce();
    expect(getGhostComparison).toHaveBeenCalledWith(USER_ID, examId);
    expect(setLatestGhostNarration).toHaveBeenCalledWith(
      USER_ID,
      "Geçmiş-ben'i geçtin, harika ivme!",
      "fake",
      examId,
      "tr",
    );
  });
});

