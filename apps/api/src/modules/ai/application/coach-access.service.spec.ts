import { beforeEach, describe, expect, it, vi } from "vitest";
import { CoachAccessMode } from "@mentor/types";
import { FeatureFlag } from "../../../common/config/config.catalog";
import { CoachAccessService } from "./coach-access.service";

describe("CoachAccessService", () => {
  let service: CoachAccessService;
  let configGet: ReturnType<typeof vi.fn>;
  let getEntitlement: ReturnType<typeof vi.fn>;
  let countSince: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    configGet = vi.fn(async (key: string) => {
      if (key === FeatureFlag.AI_ENABLED) return true;
      if (key === "ai.chat.daily_limit") return 30;
      return null;
    });
    getEntitlement = vi.fn(async () => ({ isPremium: true }));
    countSince = vi.fn(async () => 0);

    service = new CoachAccessService(
      { getEntitlement } as never,
      {} as never,
      { get: configGet } as never,
      { isWithinBudget: vi.fn(async () => true) } as never,
      { countFeatureSince: countSince } as never,
    );
  });

  it("premium access returns the remaining rolling-24h message count", async () => {
    countSince.mockResolvedValue(12);

    await expect(service.getAccess("user-1")).resolves.toEqual({
      canChat: true,
      mode: CoachAccessMode.PREMIUM,
      dailyMessagesRemaining: 18,
    });
  });

  it("premium remaining clamps to 0 when the limit is exceeded", async () => {
    countSince.mockResolvedValue(45);

    await expect(service.getAccess("user-1")).resolves.toMatchObject({
      canChat: true,
      dailyMessagesRemaining: 0,
    });
  });
});
