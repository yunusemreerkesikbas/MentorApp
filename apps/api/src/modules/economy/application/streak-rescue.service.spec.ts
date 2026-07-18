import { beforeEach, describe, expect, it, vi } from "vitest";
import { ErrorCode } from "../../../common/errors/error-code";
import { DomainError } from "../../../common/errors/domain-error";
import { HttpStatus } from "@nestjs/common";
import { StreakRescueService } from "./streak-rescue.service";

const COST = 20;

function makeFakes({
  eligible = true,
  date = "2026-07-17" as string | null,
  coin = 50,
  applyFails = false,
  alreadySpent = false,
} = {}) {
  const economy = {
    getSelfBalance: vi.fn(async () => ({ xp: 0, coinConfirmed: coin, coinPending: 0 })),
    spend: vi.fn(async () => ({
      balance: { xp: 0, coinConfirmed: coin - COST, coinPending: 0 },
      alreadySpent,
    })),
    grant: vi.fn(async () => ({ xp: 0, coinConfirmed: coin, coinPending: 0 })),
  };
  const streak = {
    getFreezeRescueState: vi.fn(async () => ({ eligible, date })),
    applyPurchasedFreeze: vi.fn(async () => {
      if (applyFails) throw new DomainError(ErrorCode.INTERNAL_ERROR, HttpStatus.INTERNAL_SERVER_ERROR);
    }),
  };
  const config = { get: vi.fn(async () => COST) };
  const service = new StreakRescueService(economy as never, streak as never, config as never);
  return { economy, streak, config, service };
}

describe("StreakRescueService", () => {
  beforeEach(() => vi.clearAllMocks());

  it("getState reports eligibility, cost and affordability", async () => {
    const { service } = makeFakes({ coin: 15 });
    const state = await service.getState("u1");
    expect(state).toMatchObject({ eligible: true, date: "2026-07-17", cost: COST, canAfford: false });
  });

  it("purchase spends coin then applies the freeze (idempotent refId userId:date)", async () => {
    const { service, economy, streak } = makeFakes();
    await service.purchase("u1");
    expect(economy.spend).toHaveBeenCalledWith("u1", COST, {
      reason: "streak.freeze.purchase",
      refType: "streak_freeze",
      refId: "u1:2026-07-17",
    });
    expect(streak.applyPurchasedFreeze).toHaveBeenCalledWith("u1", "2026-07-17");
  });

  it("purchase rejects when not eligible — nothing is spent", async () => {
    const { service, economy } = makeFakes({ eligible: false, date: null });
    await expect(service.purchase("u1")).rejects.toMatchObject({
      code: ErrorCode.STREAK_RESCUE_NOT_ELIGIBLE,
    });
    expect(economy.spend).not.toHaveBeenCalled();
  });

  it("apply failure after a fresh spend triggers a compensating refund and rethrows", async () => {
    const { service, economy } = makeFakes({ applyFails: true });
    await expect(service.purchase("u1")).rejects.toMatchObject({ code: ErrorCode.INTERNAL_ERROR });
    expect(economy.grant).toHaveBeenCalledWith("u1", "COIN", COST, {
      reason: "streak.freeze.refund",
      refType: "streak_freeze_refund",
      refId: "u1:2026-07-17",
      enforceLimits: false,
    });
  });

  it("retry of a half-applied purchase does not refund a debit it did not make", async () => {
    // Spend dedupes (alreadySpent) — if apply fails again, no refund may be issued for it.
    const { service, economy } = makeFakes({ applyFails: true, alreadySpent: true });
    await expect(service.purchase("u1")).rejects.toMatchObject({ code: ErrorCode.INTERNAL_ERROR });
    expect(economy.grant).not.toHaveBeenCalled();
  });
});
