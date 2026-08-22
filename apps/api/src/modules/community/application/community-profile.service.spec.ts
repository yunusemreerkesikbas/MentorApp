import { describe, expect, it, vi } from "vitest";

import { NotFoundError } from "../../../common/errors/domain-error";
import { CommunityService } from "./community.service";

function createService({ premium = true, economyEnabled = true } = {}) {
  const users = {
    findByUsername: vi.fn().mockResolvedValue({
      id: "user-1",
      username: "ayse",
      displayName: "Ayşe Yılmaz",
      status: "ACTIVE",
      roles: [],
      avatarStorageKey: "avatars/ayse.webp",
      examType: "KPSS",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      bio: "Her gün biraz daha ileri.",
      website: null,
    }),
  };
  const streak = { getCurrentStreak: vi.fn().mockResolvedValue(6) };
  const forum = {
    getAuthorActivity: vi.fn().mockResolvedValue({
      totalPosts: 4,
      totalThreads: 3,
      nightPosts: 0,
      reactionsReceived: 2,
    }),
  };
  const economy = {
    getSelfBalance: vi.fn().mockResolvedValue({
      xp: 411,
      level: {
        tier: 3,
        xp: 411,
        nextAt: 600,
        key: "compass",
        chapter: "awakening",
        currentAt: 300,
        nextKey: "cycle",
        progress: { current: 111, target: 300, remaining: 189, percent: 37 },
      },
    }),
  };
  const follow = {
    countFollowers: vi.fn().mockResolvedValue(12),
    countFollowing: vi.fn().mockResolvedValue(8),
    isFollowing: vi.fn().mockResolvedValue(false),
  };
  const buddy = { getStatusBetween: vi.fn().mockResolvedValue("none") };
  const config = { get: vi.fn().mockResolvedValue(economyEnabled) };
  const storage = { getPublicUrl: vi.fn().mockReturnValue("https://cdn.test/ayse.webp") };
  const entitlement = {
    getEntitlement: vi.fn().mockResolvedValue({ isPremium: premium }),
  };

  const service = new CommunityService(
    users as never,
    streak as never,
    forum as never,
    economy as never,
    follow as never,
    buddy as never,
    config as never,
    storage as never,
    entitlement as never,
  );
  return { service, users, economy, entitlement };
}

describe("CommunityService public profile", () => {
  it("publishes the combined thread and reply activity count", async () => {
    const { service } = createService();

    const profile = await service.getPublicProfile("ayse", "viewer-1");

    expect(profile.activityCount).toBe(7);
  });

  it("publishes the economy-derived journey level without recalculating it", async () => {
    const { service } = createService();

    const profile = await service.getPublicProfile("ayse", "viewer-1");

    expect(profile.level).toMatchObject({
      tier: 3,
      key: "compass",
      chapter: "awakening",
      progress: { current: 111, target: 300, remaining: 189, percent: 37 },
    });
  });

  it("publishes only the premium boolean from entitlement", async () => {
    const { service, entitlement } = createService({ premium: true });

    const profile = await service.getPublicProfile("ayse", "viewer-1");

    expect(entitlement.getEntitlement).toHaveBeenCalledWith("user-1", []);
    expect(profile.isPremium).toBe(true);
    expect(profile).not.toHaveProperty("premiumReason");
    expect(profile).not.toHaveProperty("premiumValidUntil");
  });

  it("publishes false for a free member", async () => {
    const { service } = createService({ premium: false });

    const profile = await service.getPublicProfile("ayse", "viewer-1");

    expect(profile.isPremium).toBe(false);
  });

  it.each([null, "BANNED", "SUSPENDED"])(
    "does not expose missing or blocked members (%s)",
    async (status) => {
      const { service, users } = createService();
      if (status === null) users.findByUsername.mockResolvedValueOnce(null);
      else users.findByUsername.mockResolvedValueOnce({
        id: "user-1",
        username: "ayse",
        status,
      });

      await expect(service.getPublicProfile("ayse", "viewer-1")).rejects.toBeInstanceOf(
        NotFoundError,
      );
    },
  );

  it("keeps public activity and premium data available while economy is disabled", async () => {
    const { service, economy } = createService({ premium: true, economyEnabled: false });

    const profile = await service.getPublicProfile("ayse", "viewer-1");

    expect(profile).toMatchObject({
      activityCount: 7,
      isPremium: true,
      xp: null,
      level: null,
    });
    expect(economy.getSelfBalance).not.toHaveBeenCalled();
  });
});
