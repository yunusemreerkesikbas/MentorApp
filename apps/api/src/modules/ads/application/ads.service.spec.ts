import { describe, expect, it, vi } from "vitest";
import { AdPlacementId, ExamType } from "@mentor/types";
import { AdsService } from "./ads.service";

const CONFIG: Record<string, number | boolean> = {
  "ads.enabled": true,
  "ads.display.enabled": true,
  "ads.rewarded.enabled": true,
  "ads.placement.knowledge_article_end.enabled": true,
  "ads.placement.dashboard_rewarded_coin.enabled": true,
  "ads.rewarded.web.reward_coin": 5,
  "ads.rewarded.web.daily_limit": 2,
  "ads.rewarded.web.cooldown_seconds": 900,
  "ads.rewarded.web.session_ttl_seconds": 300,
  "ads.rewarded.web.rollout_percent": 100,
};

function setup(isPremium = false) {
  const sessions: any[] = [];
  const repo = {
    withServiceTx: async (fn: (tx: object) => Promise<unknown>) => fn({}),
    acquireUserLock: vi.fn(),
    rewardedCountSince: async () => sessions.filter((row) => row.status === "REWARDED").length,
    latestRewarded: async () => sessions.find((row) => row.status === "REWARDED"),
    findActive: async (userId: string) => sessions.find((row) => row.userId === userId && row.status === "CREATED" && row.expiresAt > new Date()),
    listExpiredCreated: async () => [],
    create: async (entry: any) => {
      const row = { ...entry, platform: "WEB", provider: "GOOGLE_AD_MANAGER", proofType: "CLIENT_EVENT", status: "CREATED", rewardedAt: null, rejectionCode: null, providerTransactionId: null, createdAt: new Date(), updatedAt: new Date() };
      sessions.push(row);
      return row;
    },
    findOwned: async (id: string, userId: string) => sessions.find((row) => row.id === id && row.userId === userId),
    setStatus: async (id: string, _from: string, status: string) => {
      const row = sessions.find((item) => item.id === id);
      if (!row || row.status !== "CREATED") return false;
      row.status = status;
      if (status === "REWARDED") row.rewardedAt = new Date();
      return true;
    },
  };
  const economy = {
    reserveCoinGrantInServiceTx: vi.fn(),
    settleCoinGrantInServiceTx: vi.fn(),
    releaseCoinGrantInServiceTx: vi.fn(),
    getAdminBalance: async () => ({ coinConfirmed: 5, coinPending: 0, xp: 0 }),
  };
  const service = new AdsService(
    repo as never,
    { get: async (key: string) => CONFIG[key] } as never,
    { get: (key: string) => key.includes("KNOWLEDGE") ? "/network/article" : "/network/reward" } as never,
    { getEntitlement: async () => ({ isPremium }) } as never,
    { getDiscoveryProfile: async () => ({ examType: ExamType.LGS }) } as never,
    economy as never,
  );
  return { service, sessions, economy };
}

describe("AdsService", () => {
  it("returns an ineligible placement for Premium without weakening child treatment rules", async () => {
    const view = await setup(true).service.getPlacement(
      AdPlacementId.KNOWLEDGE_ARTICLE_END,
      "user-1",
      [],
      "TR",
    );
    expect(view).toMatchObject({ enabled: false, reason: "PREMIUM_AD_FREE" });
  });

  it("creates one reserved session and completes duplicate callbacks idempotently", async () => {
    const { service, economy } = setup();
    const session = await service.createRewardSession(
      AdPlacementId.DASHBOARD_REWARDED_COIN,
      { id: "user-1", roles: [], orgId: null },
      "TR",
    );
    const first = await service.completeRewardSession(session.id, "user-1");
    const second = await service.completeRewardSession(session.id, "user-1");

    expect(first.balance).toBe(5);
    expect(second.status).toBe("REWARDED");
    expect(economy.reserveCoinGrantInServiceTx).toHaveBeenCalledTimes(1);
    expect(economy.settleCoinGrantInServiceTx).toHaveBeenCalledTimes(1);
  });

  it("releases the reservation when the user closes before a reward", async () => {
    const { service, economy } = setup();
    const session = await service.createRewardSession(
      AdPlacementId.DASHBOARD_REWARDED_COIN,
      { id: "user-1", roles: [], orgId: null },
      "TR",
    );
    await service.closeRewardSession(session.id, "user-1");
    await service.closeRewardSession(session.id, "user-1");
    expect(economy.releaseCoinGrantInServiceTx).toHaveBeenCalledTimes(1);
  });
});
