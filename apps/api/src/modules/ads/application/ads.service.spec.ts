import { describe, expect, it, vi } from "vitest";
import { AdPlacementId, ExamType } from "@mentor/types";
import { AdsService } from "./ads.service";
import type {
  AdRewardSessionRow,
  NewAdRewardSession,
} from "../infrastructure/ad-reward-session.repository";

const CONFIG: Record<string, number | boolean> = {
  "ads.enabled": true,
  "ads.display.enabled": true,
  "ads.rewarded.enabled": true,
  "ads.placement.knowledge_article_end.enabled": true,
  "ads.placement.dashboard_rewarded_coin.enabled": true,
  "ads.rewarded.web.reward_coin": 5,
  "ads.rewarded.web.daily_limit": 2,
  "ads.rewarded.web.cooldown_seconds": 0,
  "ads.rewarded.web.session_ttl_seconds": 300,
  "ads.rewarded.web.rollout_percent": 100,
};

function setup(
  isPremium = false,
  options: { profileExamType?: ExamType; articleFamily?: ExamType } = {},
) {
  const sessions: AdRewardSessionRow[] = [];
  const rewardedCountSince = vi.fn(async () => sessions.filter((row) => row.status === "REWARDED").length);
  const repo = {
    withServiceTx: async (fn: (tx: object) => Promise<unknown>) => fn({}),
    acquireUserLock: vi.fn(),
    rewardedCountSince,
    latestRewarded: async () => sessions.find((row) => row.status === "REWARDED"),
    findActive: async (userId: string) => sessions.find((row) => row.userId === userId && row.status === "CREATED" && row.expiresAt > new Date()),
    findByIdempotencyKey: async (userId: string, key: string) =>
      sessions.find((row) => row.userId === userId && row.idempotencyKey === key),
    listExpiredCreated: async () => [],
    listExpiredCandidates: async (now: Date, limit: number) =>
      sessions
        .filter((row) => row.status === "CREATED" && row.expiresAt <= now)
        .slice(0, limit),
    lockExpiredForUser: async (userId: string, now: Date, limit: number) =>
      sessions
        .filter(
          (row) =>
            row.userId === userId && row.status === "CREATED" && row.expiresAt <= now,
        )
        .slice(0, limit),
    create: async (entry: NewAdRewardSession) => {
      const row: AdRewardSessionRow = { ...entry, platform: "WEB", provider: "GOOGLE_AD_MANAGER", proofType: "CLIENT_EVENT", status: "CREATED", rewardedAt: null, rejectionCode: null, providerTransactionId: null, createdAt: new Date(), updatedAt: new Date() };
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
    { getDiscoveryProfile: async () => ({ examType: options.profileExamType ?? ExamType.LGS }) } as never,
    economy as never,
    {
      getInfoArticleBySlug: async () => ({ family: options.articleFamily ?? ExamType.LGS }),
    } as never,
  );
  return { service, sessions, economy, rewardedCountSince };
}

describe("AdsService", () => {
  it("returns an ineligible placement for Premium without weakening child treatment rules", async () => {
    const view = await setup(true).service.getPlacement(
      AdPlacementId.KNOWLEDGE_ARTICLE_END,
      "user-1",
      [],
      "lgs-guide",
      "TR",
    );
    expect(view).toMatchObject({ enabled: false, reason: "PREMIUM_AD_FREE" });
  });

  it("derives anonymous contextual treatment from published content, not the legacy query", async () => {
    const view = await setup(false, { articleFamily: ExamType.LGS }).service.getPublicPlacement(
      AdPlacementId.KNOWLEDGE_ARTICLE_END,
      "lgs-guide",
      ExamType.KPSS,
      "TR",
    );

    expect(view).toMatchObject({ enabled: true, audienceTreatment: "CHILD" });
  });

  it("does not expose an ad unit without verified contextual content", async () => {
    const view = await setup().service.getPublicPlacement(
      AdPlacementId.KNOWLEDGE_ARTICLE_END,
      null,
      ExamType.KPSS,
      "TR",
    );

    expect(view).toMatchObject({
      enabled: false,
      reason: "CONTEXT_UNVERIFIED",
      adUnitPath: null,
    });
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

  it("keeps the second daily reward offer eligible immediately after the first completion", async () => {
    const { service } = setup();
    const first = await service.createRewardSession(
      AdPlacementId.DASHBOARD_REWARDED_COIN,
      { id: "user-1", roles: [], orgId: null },
      "TR",
    );
    await service.completeRewardSession(first.id, "user-1");

    const offer = await service.getRewardOffer(
      AdPlacementId.DASHBOARD_REWARDED_COIN,
      "user-1",
      [],
      "TR",
    );

    expect(offer).toMatchObject({
      eligible: true,
      reason: "ELIGIBLE",
      dailyRemaining: 1,
      cooldownEndsAt: null,
    });
  });

  it("returns the same session when creation is retried with one idempotency key", async () => {
    const { service, economy, sessions } = setup();
    const key = "11111111-1111-4111-8111-111111111111";

    const first = await service.createRewardSession(
      AdPlacementId.DASHBOARD_REWARDED_COIN,
      { id: "user-1", roles: [], orgId: null },
      "TR",
      key,
    );
    const replay = await service.createRewardSession(
      AdPlacementId.DASHBOARD_REWARDED_COIN,
      { id: "user-1", roles: [], orgId: null },
      "TR",
      key,
    );

    expect(replay.id).toBe(first.id);
    expect(sessions).toHaveLength(1);
    expect(economy.reserveCoinGrantInServiceTx).toHaveBeenCalledTimes(1);
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

  it("does not let another user read or complete a reward session", async () => {
    const { service, economy } = setup();
    const session = await service.createRewardSession(
      AdPlacementId.DASHBOARD_REWARDED_COIN,
      { id: "user-1", roles: [], orgId: null },
      "TR",
    );

    await expect(service.completeRewardSession(session.id, "user-2")).rejects.toMatchObject({
      code: "ADS_SESSION_NOT_FOUND",
    });
    expect(economy.settleCoinGrantInServiceTx).not.toHaveBeenCalled();
  });

  it("counts rewarded sessions from the start of the Istanbul calendar day", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-29T20:59:59.000Z"));
    try {
      const { service, rewardedCountSince } = setup();
      await service.getRewardOffer(
        AdPlacementId.DASHBOARD_REWARDED_COIN,
        "user-1",
        [],
        "TR",
      );

      expect(rewardedCountSince).toHaveBeenCalledWith(
        "user-1",
        AdPlacementId.DASHBOARD_REWARDED_COIN,
        new Date("2026-08-28T21:00:00.000Z"),
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it("expires a bounded batch and releases each Coin reservation", async () => {
    const { service, sessions, economy } = setup();
    sessions.push({
      id: "expired-session",
      userId: "user-1",
      placementId: AdPlacementId.DASHBOARD_REWARDED_COIN,
      status: "CREATED",
      rewardCoin: 5,
      expiresAt: new Date("2026-08-01T00:00:00.000Z"),
      createdAt: new Date("2026-08-01T00:00:00.000Z"),
      updatedAt: new Date("2026-08-01T00:00:00.000Z"),
    });

    const result = await service.expireDueSessions(200);

    expect(result).toEqual({ expired: 1 });
    expect(sessions[0]?.status).toBe("EXPIRED");
    expect(economy.releaseCoinGrantInServiceTx).toHaveBeenCalledTimes(1);
  });
});
