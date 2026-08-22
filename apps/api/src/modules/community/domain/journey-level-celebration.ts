export type JourneyLevelCelebrationKind = "INTRODUCTION" | "LEVEL_UP";

export interface JourneyLevelCelebrationRecord {
  id: string;
  tier: number;
  kind: JourneyLevelCelebrationKind;
  resolvedAt: Date | null;
}

export interface JourneyLevelCelebrationSyncPlan {
  insert: {
    kind: JourneyLevelCelebrationKind;
    tier: number;
    unlockedAt: Date;
  } | null;
  supersedeIds: string[];
}

export function planJourneyLevelCelebrationSync(
  recorded: readonly JourneyLevelCelebrationRecord[],
  currentTier: number,
  observedAt: Date,
): JourneyLevelCelebrationSyncPlan {
  if (recorded.length === 0) {
    return {
      insert: { kind: "INTRODUCTION", tier: currentTier, unlockedAt: observedAt },
      supersedeIds: [],
    };
  }

  const highestRecordedTier = Math.max(...recorded.map((entry) => entry.tier));
  if (currentTier <= highestRecordedTier) return { insert: null, supersedeIds: [] };

  return {
    insert: { kind: "LEVEL_UP", tier: currentTier, unlockedAt: observedAt },
    supersedeIds: recorded
      .filter((entry) => entry.resolvedAt === null && entry.tier < currentTier)
      .map((entry) => entry.id),
  };
}
