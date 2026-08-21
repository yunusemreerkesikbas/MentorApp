import { describe, expect, it } from "vitest";
import type { AchievementId, AchievementView } from "@mentor/types";
import {
  buildAchievementCollection,
  groupAchievementCelebrations,
  type EarnedAchievement,
} from "./achievement-collection";
import { ACHIEVEMENT_IDS } from "./achievement-definitions";

const translate = (key: string) => key;

function earned(
  id: AchievementId,
  source: "LIVE" | "BACKFILL" = "LIVE",
): EarnedAchievement {
  return {
    id,
    source,
    earnedAt: new Date("2026-08-18T10:00:00.000Z"),
  };
}

describe("achievement collection", () => {
  it("returns all twelve definitions to the owner with monotonic rhythm progress", () => {
    const collection = buildAchievementCollection({
      ownerView: true,
      earned: [earned("first_step")],
      longestStreak: 11,
      translate,
    });

    expect(collection.items).toHaveLength(12);
    expect(collection.items[0]).toMatchObject({
      id: "first_step",
      status: "EARNED",
      earnedAt: "2026-08-18T10:00:00.000Z",
      unlockHint: "achievements.items.first_step.unlockHint",
    });
    expect(collection.items.find((item) => item.id === "rhythm_found")?.progress).toEqual({
      current: 7,
      target: 7,
    });
    expect(collection.items.find((item) => item.id === "rhythm_kept")?.progress).toEqual({
      current: 11,
      target: 30,
    });
    expect(collection.items.find((item) => item.id === "returned_to_path")?.progress).toBeNull();
    expect(collection.summary).toEqual({
      earnedCount: 1,
      totalCount: 12,
      suggestedAchievementId: "rhythm_found",
    });
  });

  it("uses catalog order when measurable progress ratios are equal", () => {
    const collection = buildAchievementCollection({
      ownerView: true,
      earned: [],
      longestStreak: 30,
      translate,
    });

    expect(collection.summary?.suggestedAchievementId).toBe("rhythm_found");
  });

  it("falls back to the first locked catalog item when no measurable progress exists", () => {
    const collection = buildAchievementCollection({
      ownerView: true,
      earned: [earned("first_step")],
      longestStreak: 0,
      translate,
    });

    expect(collection.summary?.suggestedAchievementId).toBe("route_drawn");
  });

  it("returns no suggestion when the owner has completed the collection", () => {
    const collection = buildAchievementCollection({
      ownerView: true,
      earned: ACHIEVEMENT_IDS.map((id) => earned(id)),
      longestStreak: 30,
      translate,
    });

    expect(collection.summary).toEqual({
      earnedCount: 12,
      totalCount: 12,
      suggestedAchievementId: null,
    });
  });

  it("returns only earned achievements to a visitor and never exposes progress", () => {
    const collection = buildAchievementCollection({
      ownerView: false,
      earned: [earned("first_step"), earned("route_drawn")],
      longestStreak: 30,
      translate,
    });

    expect(collection.items.map((item) => item.id)).toEqual(["first_step", "route_drawn"]);
    expect(collection.items.every((item) => item.progress === null)).toBe(true);
    expect(collection.summary).toBeNull();
  });

  it("groups unseen backfill rows once while keeping live awards individual", () => {
    const views = new Map<AchievementId, AchievementView>([
      ["first_step", view("first_step")],
      ["route_drawn", view("route_drawn")],
      ["rhythm_found", view("rhythm_found")],
    ]);

    const result = groupAchievementCelebrations(
      [
        earned("first_step", "BACKFILL"),
        earned("route_drawn", "BACKFILL"),
        earned("rhythm_found", "LIVE"),
      ],
      views,
    );

    expect(result).toEqual([
      {
        kind: "BACKFILL_SUMMARY",
        items: [views.get("first_step"), views.get("route_drawn")],
      },
      { kind: "ACHIEVEMENT", items: [views.get("rhythm_found")] },
    ]);
  });
});

function view(id: AchievementId): AchievementView {
  return {
    id,
    title: id,
    description: id,
    unlockHint: id,
    artKey: id,
    status: "EARNED",
    earnedAt: "2026-08-18T10:00:00.000Z",
    progress: null,
  };
}
