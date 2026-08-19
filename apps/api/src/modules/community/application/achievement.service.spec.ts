import { describe, expect, it, vi } from "vitest";
import { AchievementService } from "./achievement.service";

function setup(enabled = true) {
  const repository = {
    listByUser: vi.fn().mockResolvedValue([
      {
        achievementId: "first_step",
        source: "LIVE",
        earnedAt: new Date("2026-08-18T10:00:00.000Z"),
        celebratedAt: null,
      },
    ]),
    listUnseen: vi.fn().mockResolvedValue([]),
    award: vi.fn().mockResolvedValue({
      achievementId: "first_step",
      source: enabled ? "LIVE" : "BACKFILL",
      earnedAt: new Date("2026-08-18T10:00:00.000Z"),
    }),
    markCelebrated: vi.fn().mockResolvedValue(undefined),
  };
  const users = {
    findByUsername: vi.fn().mockResolvedValue({
      id: "target",
      orgId: "org-1",
      username: "ayse",
      status: "ACTIVE",
    }),
    getAchievementOwner: vi.fn().mockResolvedValue({
      id: "target",
      orgId: "org-1",
      username: "ayse",
    }),
  };
  const streak = { getLongestStreak: vi.fn().mockResolvedValue(9) };
  const config = { get: vi.fn().mockResolvedValue(enabled) };
  const i18n = { translate: vi.fn((key: string) => key) };
  const events = { emit: vi.fn() };
  const service = new AchievementService(
    repository as never,
    users as never,
    streak as never,
    config as never,
    i18n as never,
    events as never,
  );
  return { service, repository, events };
}

describe("AchievementService", () => {
  it("returns the complete catalogue with private progress to the owner", async () => {
    const { service } = setup();

    const result = await service.getCollection("ayse", "target", "tr");

    expect(result.ownerView).toBe(true);
    expect(result.items).toHaveLength(12);
    expect(result.items.find((item) => item.id === "rhythm_found")?.progress).toEqual({
      current: 7,
      target: 7,
    });
  });

  it("returns only earned achievements without progress to a visitor", async () => {
    const { service } = setup();

    const result = await service.getCollection("ayse", "viewer", "en");

    expect(result.ownerView).toBe(false);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.progress).toBeNull();
  });

  it("stores awards as backfill and emits no public event while exposure is disabled", async () => {
    const { service, repository, events } = setup(false);

    await service.award("target", "first_step", new Date("2026-08-18T10:00:00.000Z"));

    expect(repository.award).toHaveBeenCalledWith(
      expect.objectContaining({ source: "BACKFILL", orgId: "org-1" }),
    );
    expect(events.emit).not.toHaveBeenCalled();
  });

  it("emits one event only when a live award was newly inserted", async () => {
    const { service, repository, events } = setup(true);

    await service.award("target", "first_step", new Date("2026-08-18T10:00:00.000Z"));
    repository.award.mockResolvedValueOnce(null);
    await service.award("target", "first_step", new Date("2026-08-18T11:00:00.000Z"));

    expect(events.emit).toHaveBeenCalledTimes(1);
  });
});
