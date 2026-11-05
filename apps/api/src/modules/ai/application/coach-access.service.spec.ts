import { beforeEach, describe, expect, it, vi } from "vitest";
import { CoachAccessMode } from "@mentor/types";
import { FeatureFlag } from "../../../common/config/config.catalog";
import { CoachAccessService } from "./coach-access.service";

describe("CoachAccessService", () => {
  let service: CoachAccessService;
  let configGet: ReturnType<typeof vi.fn>;
  let getEntitlement: ReturnType<typeof vi.fn>;
  let readQuota: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    configGet = vi.fn(async (key: string) => {
      if (key === FeatureFlag.AI_ENABLED) return true;
      if (key === "ai.chat.daily_limit") return 30;
      return null;
    });
    getEntitlement = vi.fn(async () => ({ isPremium: true }));
    readQuota = vi.fn(async () => ({ dailyRemaining: 20, monthlyRemaining: 100, retryAt: null }));

    service = new CoachAccessService(
      { getEntitlement } as never,
      {} as never,
      { get: configGet } as never,
      { isWithinBudget: vi.fn(async () => true) } as never,
      {} as never,
      { isAllowed: vi.fn(async () => false) } as never,
      { read: readQuota } as never,
    );
  });

  it("premium access returns both remaining counts", async () => {
    readQuota.mockResolvedValue({ dailyRemaining: 18, monthlyRemaining: 90, retryAt: null });

    await expect(service.getAccess("user-1")).resolves.toEqual({
      canChat: true,
      mode: CoachAccessMode.PREMIUM,
      dailyMessagesRemaining: 18,
      monthlyMessagesRemaining: 90,
    });
  });

  it("blocks generation when only the monthly quota is exhausted", async () => {
    const retryAt = "2026-11-12T08:00:00.000Z";
    readQuota.mockResolvedValue({ dailyRemaining: 18, monthlyRemaining: 0, retryAt });

    await expect(service.getAccess("user-1")).resolves.toEqual({
      canChat: false,
      mode: CoachAccessMode.PREMIUM,
      reason: "AI_CHAT_QUOTA_EXCEEDED",
      dailyMessagesRemaining: 18,
      monthlyMessagesRemaining: 0,
      retryAt,
    });
  });
});
