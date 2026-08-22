import { beforeEach, describe, expect, it, vi } from "vitest";
import { ErrorCode } from "../../../common/errors/error-code";
import { DeepAnalysisService } from "./deep-analysis.service";

const EXAM = "00000000-0000-4000-8000-000000000001";

describe("DeepAnalysisService", () => {
  let reviewStatus: "READY" | "INSUFFICIENT";
  let premium: boolean;
  let coin: number;
  let spentRefs: Set<string>;
  let spend: ReturnType<typeof vi.fn>;
  let service: DeepAnalysisService;

  beforeEach(() => {
    reviewStatus = "READY";
    premium = false;
    coin = 30;
    spentRefs = new Set();
    spend = vi.fn(async (_userId: string, cost: number, opts: { refId: string }) => {
      const alreadySpent = spentRefs.has(opts.refId);
      if (!alreadySpent) {
        if (coin < cost) {
          const err = new Error("insufficient") as Error & { code: string };
          err.code = ErrorCode.INSUFFICIENT_COIN;
          throw err;
        }
        coin -= cost;
        spentRefs.add(opts.refId);
      }
      return { balance: { xp: 0, coinConfirmed: coin, coinPending: 0 }, alreadySpent };
    });
    service = new DeepAnalysisService(
      {
        spend,
        getSelfBalance: async () => ({ xp: 0, coinConfirmed: coin, coinPending: 0 }),
      } as never,
      { existsByRef: async (_t: string, refId: string) => spentRefs.has(refId) } as never,
      {
        getReview: async () => ({
          status: reviewStatus,
          period: { startDate: "2026-07-13", endDate: "2026-07-19", timeZone: "Europe/Istanbul" },
        }),
      } as never,
      { getEntitlement: async () => ({ isPremium: premium }) } as never,
      {
        get: async (key: string) => {
          if (key === "economy.coin.deep_analysis_cost") return 25;
          if (key === "ai.features.deep.analysis.free_enabled") return false;
          return 0;
        },
      } as never,
    );
  });

  it("reports an eligible, affordable, locked state for a free user", async () => {
    expect(await service.getState("u1", [], EXAM)).toMatchObject({
      eligible: true,
      weekStart: "2026-07-13",
      cost: 25,
      coinConfirmed: 30,
      canAfford: true,
      unlocked: false,
      premium: false,
    });
  });

  it("purchase debits once and unlocks; a repeat purchase never double-debits", async () => {
    const first = await service.purchase("u1", [], EXAM);
    expect(first.unlocked).toBe(true);
    expect(first.coinConfirmed).toBe(5);
    expect(spend).toHaveBeenCalledWith(
      "u1",
      25,
      expect.objectContaining({ refId: `u1:${EXAM}:2026-07-13` }),
    );

    const second = await service.purchase("u1", [], EXAM);
    expect(second.coinConfirmed).toBe(5); // unlocked short-circuit — no second debit
    expect(spend).toHaveBeenCalledTimes(1);
  });

  it("premium users are unlocked without any debit", async () => {
    premium = true;
    const state = await service.purchase("u1", [], EXAM);
    expect(state).toMatchObject({ unlocked: true, premium: true });
    expect(spend).not.toHaveBeenCalled();
  });

  it("rejects purchase when the weekly review is not READY", async () => {
    reviewStatus = "INSUFFICIENT";
    await expect(service.purchase("u1", [], EXAM)).rejects.toMatchObject({
      code: ErrorCode.DEEP_ANALYSIS_NOT_ELIGIBLE,
    });
    expect(spend).not.toHaveBeenCalled();
  });

  it("propagates INSUFFICIENT_COIN from the spend", async () => {
    coin = 10;
    await expect(service.purchase("u1", [], EXAM)).rejects.toMatchObject({
      code: ErrorCode.INSUFFICIENT_COIN,
    });
  });

  it("isUnlocked keys on (user, exam, weekStart)", async () => {
    await service.purchase("u1", [], EXAM);
    expect(await service.isUnlocked("u1", EXAM, "2026-07-13")).toBe(true);
    expect(await service.isUnlocked("u1", EXAM, "2026-07-20")).toBe(false);
    expect(await service.isUnlocked("u2", EXAM, "2026-07-13")).toBe(false);
  });
});
