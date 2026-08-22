import type {
  AchievementCelebrationDto,
  JourneyLevelCelebrationView,
} from "@mentor/types";

export type CelebrationQueueItem =
  | {
      type: "achievement";
      celebration: AchievementCelebrationDto;
    }
  | {
      type: "journey-level";
      celebration: JourneyLevelCelebrationView;
    };

interface RankedCelebration {
  item: CelebrationQueueItem;
  group: number;
  occurredAt: number;
  tieBreaker: number;
  sourceIndex: number;
}

/**
 * Produces the single application-level celebration queue.
 * Live events are chronological, achievement history follows them, and the calm
 * journey introduction always waits until every earned celebration has finished.
 */
export function buildCelebrationQueue(
  achievementCelebrations: AchievementCelebrationDto[],
  journeyCelebrations: JourneyLevelCelebrationView[],
): CelebrationQueueItem[] {
  const ranked: RankedCelebration[] = [];

  achievementCelebrations.forEach((celebration, sourceIndex) => {
    const isHistory = celebration.kind === "BACKFILL_SUMMARY";
    ranked.push({
      item: { type: "achievement", celebration },
      group: isHistory ? 1 : 0,
      occurredAt: timestampOf(celebration.items[0]?.earnedAt),
      tieBreaker: 0,
      sourceIndex,
    });
  });

  journeyCelebrations.forEach((celebration, sourceIndex) => {
    const isIntroduction = celebration.kind === "INTRODUCTION";
    ranked.push({
      item: { type: "journey-level", celebration },
      group: isIntroduction ? 2 : 0,
      occurredAt: timestampOf(celebration.unlockedAt),
      tieBreaker: 1,
      sourceIndex,
    });
  });

  return ranked
    .sort(
      (left, right) =>
        left.group - right.group ||
        left.occurredAt - right.occurredAt ||
        left.tieBreaker - right.tieBreaker ||
        left.sourceIndex - right.sourceIndex,
    )
    .map(({ item }) => item);
}

function timestampOf(value: string | null | undefined): number {
  if (!value) return Number.MAX_SAFE_INTEGER;
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? Number.MAX_SAFE_INTEGER : timestamp;
}
