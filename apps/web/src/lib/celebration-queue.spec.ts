import type {
  AchievementCelebrationDto,
  AchievementId,
  AchievementView,
  JourneyLevelCelebrationView,
} from "@mentor/types";
import { describe, expect, it } from "vitest";

import { buildCelebrationQueue } from "./celebration-queue";

function achievement(
  id: AchievementId,
  earnedAt: string,
  kind: AchievementCelebrationDto["kind"] = "ACHIEVEMENT",
): AchievementCelebrationDto {
  const item: AchievementView = {
    id,
    title: id,
    description: id,
    unlockHint: id,
    artKey: id,
    status: "EARNED",
    earnedAt,
    progress: null,
  };

  return kind === "ACHIEVEMENT"
    ? { kind, items: [item] }
    : { kind, items: [item] };
}

function journey(
  id: string,
  unlockedAt: string,
  kind: JourneyLevelCelebrationView["kind"] = "LEVEL_UP",
): JourneyLevelCelebrationView {
  return {
    id,
    kind,
    tier: kind === "INTRODUCTION" ? 4 : 5,
    key: kind === "INTRODUCTION" ? "cycle" : "rhythm",
    chapter: "harmony",
    unlockedAt,
  };
}

describe("buildCelebrationQueue", () => {
  /* The spotlight scene is a lights-out takeover, so it plays last however the timestamps fall —
     otherwise the run peaks in the middle and fizzles out on the quieter achievement cards. */
  it("keeps the level-up behind achievements even when it happened first", () => {
    const queue = buildCelebrationQueue(
      [achievement("first_step", "2026-08-22T12:02:00.000Z")],
      [journey("level-5", "2026-08-22T12:01:00.000Z")],
    );

    expect(queue.map((item) => item.type)).toEqual([
      "achievement",
      "journey-level",
    ]);
  });

  it("puts an achievement before a level-up when timestamps match", () => {
    const occurredAt = "2026-08-22T12:00:00.000Z";
    const queue = buildCelebrationQueue(
      [achievement("first_step", occurredAt)],
      [journey("level-5", occurredAt)],
    );

    expect(queue.map((item) => item.type)).toEqual([
      "achievement",
      "journey-level",
    ]);
  });

  it("plays live achievements, then history, then the level-up, then the introduction", () => {
    const queue = buildCelebrationQueue(
      [
        achievement(
          "route_drawn",
          "2026-08-22T12:03:00.000Z",
          "BACKFILL_SUMMARY",
        ),
        achievement("first_step", "2026-08-22T12:04:00.000Z"),
      ],
      [
        journey("introduction", "2026-08-22T12:00:00.000Z", "INTRODUCTION"),
        journey("level-5", "2026-08-22T12:05:00.000Z"),
      ],
    );

    expect(queue.map((item) => item.celebration.kind)).toEqual([
      "ACHIEVEMENT",
      "BACKFILL_SUMMARY",
      "LEVEL_UP",
      "INTRODUCTION",
    ]);
  });

  it("orders several level-ups chronologically inside their own group", () => {
    const queue = buildCelebrationQueue(
      [],
      [
        journey("level-6", "2026-08-22T12:09:00.000Z"),
        journey("level-5", "2026-08-22T12:01:00.000Z"),
      ],
    );

    expect(
      queue.map((item) =>
        item.type === "journey-level" ? item.celebration.id : item.type,
      ),
    ).toEqual(["level-5", "level-6"]);
  });
});
