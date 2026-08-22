import { describe, expect, it } from "vitest";

import { planJourneyLevelCelebrationSync } from "./journey-level-celebration";

const NOW = new Date("2026-08-22T12:00:00.000Z");

describe("journey level celebration sync", () => {
  it("introduces the current tier when the journey has never been synchronized", () => {
    expect(planJourneyLevelCelebrationSync([], 5, NOW)).toEqual({
      insert: { kind: "INTRODUCTION", tier: 5, unlockedAt: NOW },
      supersedeIds: [],
    });
  });

  it("does nothing when the current tier was already recorded", () => {
    expect(
      planJourneyLevelCelebrationSync(
        [row("intro-5", 5, "INTRODUCTION", NOW)],
        5,
        new Date("2026-08-22T13:00:00.000Z"),
      ),
    ).toEqual({ insert: null, supersedeIds: [] });
  });

  it("records only the highest newly reached tier and supersedes unresolved lower cards", () => {
    expect(
      planJourneyLevelCelebrationSync(
        [
          row("intro-5", 5, "INTRODUCTION", null),
          row("level-6", 6, "LEVEL_UP", null),
        ],
        8,
        NOW,
      ),
    ).toEqual({
      insert: { kind: "LEVEL_UP", tier: 8, unlockedAt: NOW },
      supersedeIds: ["intro-5", "level-6"],
    });
  });

  it("never reopens a tier after a negative XP correction and recovery", () => {
    const recorded = [row("level-8", 8, "LEVEL_UP", NOW)];

    expect(planJourneyLevelCelebrationSync(recorded, 7, NOW)).toEqual({
      insert: null,
      supersedeIds: [],
    });
    expect(planJourneyLevelCelebrationSync(recorded, 8, NOW)).toEqual({
      insert: null,
      supersedeIds: [],
    });
  });

  it("celebrates Constellation once and never reopens it", () => {
    expect(
      planJourneyLevelCelebrationSync(
        [row("level-11", 11, "LEVEL_UP", NOW)],
        12,
        new Date("2026-08-23T12:00:00.000Z"),
      ),
    ).toEqual({
      insert: {
        kind: "LEVEL_UP",
        tier: 12,
        unlockedAt: new Date("2026-08-23T12:00:00.000Z"),
      },
      supersedeIds: [],
    });

    expect(
      planJourneyLevelCelebrationSync(
        [row("level-12", 12, "LEVEL_UP", NOW)],
        12,
        new Date("2026-08-24T12:00:00.000Z"),
      ),
    ).toEqual({ insert: null, supersedeIds: [] });
  });
});

function row(
  id: string,
  tier: number,
  kind: "INTRODUCTION" | "LEVEL_UP",
  resolvedAt: Date | null,
) {
  return { id, tier, kind, resolvedAt } as const;
}
