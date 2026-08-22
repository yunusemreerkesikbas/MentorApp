import { describe, expect, it, vi } from "vitest";

import { JourneyLevelCelebrationService } from "./journey-level-celebration.service";

const RHYTHM_LEVEL = {
  tier: 5,
  xp: 1120,
  nextAt: 1500,
  key: "rhythm",
  chapter: "harmony",
  currentAt: 1000,
  nextKey: "flow",
  progress: { current: 120, target: 500, remaining: 380, percent: 24 },
} as const;

function setup(enabled = true) {
  const row = {
    id: "10000000-0000-4000-8000-000000000001",
    userId: "user-1",
    orgId: "org-1",
    tier: 5,
    kind: "INTRODUCTION",
    unlockedAt: new Date("2026-08-22T12:00:00.000Z"),
    resolvedAt: null,
    resolution: null,
    createdAt: new Date("2026-08-22T12:00:00.000Z"),
  } as const;
  const repository = {
    synchronize: vi.fn().mockResolvedValue(row),
    listUnresolved: vi.fn().mockResolvedValue([row]),
    markShown: vi.fn().mockResolvedValue(undefined),
  };
  const economy = { getSelfBalance: vi.fn().mockResolvedValue({ xp: 1120, level: RHYTHM_LEVEL }) };
  const users = {
    getAchievementOwner: vi.fn().mockResolvedValue({ id: "user-1", orgId: "org-1" }),
  };
  const config = { get: vi.fn().mockResolvedValue(enabled) };
  const events = { emit: vi.fn() };
  const service = new JourneyLevelCelebrationService(
    repository as never,
    economy as never,
    users as never,
    config as never,
    events as never,
  );
  return { service, repository, economy, users, events, row };
}

describe("JourneyLevelCelebrationService", () => {
  it("returns no celebrations while economy is disabled", async () => {
    const { service, repository, economy } = setup(false);

    await expect(service.getUnseen("user-1")).resolves.toEqual({ celebrations: [] });
    expect(economy.getSelfBalance).not.toHaveBeenCalled();
    expect(repository.synchronize).not.toHaveBeenCalled();
  });

  it("synchronizes the current level and returns its canonical identity", async () => {
    const { service } = setup();

    await expect(service.getUnseen("user-1")).resolves.toEqual({
      celebrations: [
        {
          id: "10000000-0000-4000-8000-000000000001",
          kind: "INTRODUCTION",
          tier: 5,
          key: "rhythm",
          chapter: "harmony",
          unlockedAt: "2026-08-22T12:00:00.000Z",
        },
      ],
    });
  });

  it("emits a realtime community event only for a newly persisted live level-up", async () => {
    const { service, repository, events, row } = setup();
    repository.synchronize.mockResolvedValueOnce({ ...row, tier: 6, kind: "LEVEL_UP" });

    await service.synchronizeLive("user-1", { ...RHYTHM_LEVEL, tier: 6, key: "flow" }, new Date("2026-08-22T13:00:00.000Z"));
    repository.synchronize.mockResolvedValueOnce(null);
    await service.synchronizeLive("user-1", { ...RHYTHM_LEVEL, tier: 6, key: "flow" }, new Date("2026-08-22T13:01:00.000Z"));

    expect(events.emit).toHaveBeenCalledTimes(1);
    expect(events.emit).toHaveBeenCalledWith(
      "community.journey-level.unlocked",
      expect.objectContaining({
        celebrationId: "10000000-0000-4000-8000-000000000001",
        userId: "user-1",
        tier: 6,
      }),
    );
  });

  it("acknowledges the exact celebration id idempotently", async () => {
    const { service, repository } = setup();

    await service.markCelebrated("user-1", "10000000-0000-4000-8000-000000000001");

    expect(repository.markShown).toHaveBeenCalledWith(
      "user-1",
      "10000000-0000-4000-8000-000000000001",
    );
  });
});
