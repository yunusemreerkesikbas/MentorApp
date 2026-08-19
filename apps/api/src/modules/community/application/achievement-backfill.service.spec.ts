import { describe, expect, it, vi } from "vitest";
import { AchievementBackfillService } from "./achievement-backfill.service";

describe("AchievementBackfillService", () => {
  it("collects evidence in batches and stays repeatable through conflict-safe bulk inserts", async () => {
    const users = {
      listAchievementCandidates: vi.fn()
        .mockResolvedValue([{ id: "user-1", orgId: "org-1" }]),
    };
    const coaching = {
      collect: vi.fn().mockResolvedValue([{ userId: "user-1", achievementId: "first_step", earnedAt: new Date("2026-08-01") }]),
    };
    const forum = { collect: vi.fn().mockResolvedValue([]) };
    const repository = {
      awardMany: vi.fn()
        .mockResolvedValueOnce([{ id: "award-1" }])
        .mockResolvedValueOnce([]),
    };
    const service = new AchievementBackfillService(
      users as never,
      coaching as never,
      forum as never,
      repository as never,
    );

    await expect(service.run(100)).resolves.toEqual({ users: 1, inserted: 1 });
    await expect(service.run(100)).resolves.toEqual({ users: 1, inserted: 0 });
    expect(coaching.collect).toHaveBeenCalledTimes(2);
    expect(repository.awardMany).toHaveBeenCalledWith([
      expect.objectContaining({ userId: "user-1", achievementId: "first_step", source: "BACKFILL" }),
    ]);
  });
});
