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
  sourceIndex: number;
}

/**
 * Ordering groups, played low to high. Items inside a group run chronologically.
 *
 * Journey levels come after every achievement on purpose: since the spotlight scene took over the
 * level celebration, a level-up is a full lights-out cinematic. Interleaving it with the quieter
 * achievement cards made the sequence peak in the middle and then fizzle, so the takeover is
 * always the last thing a student sees.
 */
const GROUP = {
  achievement: 0,
  achievementHistory: 1,
  levelUp: 2,
  introduction: 3,
} as const;

/** Produces the single application-level celebration queue. */
export function buildCelebrationQueue(
  achievementCelebrations: AchievementCelebrationDto[],
  journeyCelebrations: JourneyLevelCelebrationView[],
): CelebrationQueueItem[] {
  const ranked: RankedCelebration[] = [];

  achievementCelebrations.forEach((celebration, sourceIndex) => {
    ranked.push({
      item: { type: "achievement", celebration },
      group:
        celebration.kind === "BACKFILL_SUMMARY"
          ? GROUP.achievementHistory
          : GROUP.achievement,
      occurredAt: timestampOf(celebration.items[0]?.earnedAt),
      sourceIndex,
    });
  });

  journeyCelebrations.forEach((celebration, sourceIndex) => {
    ranked.push({
      item: { type: "journey-level", celebration },
      group:
        celebration.kind === "INTRODUCTION" ? GROUP.introduction : GROUP.levelUp,
      occurredAt: timestampOf(celebration.unlockedAt),
      sourceIndex,
    });
  });

  return ranked
    .sort(
      (left, right) =>
        left.group - right.group ||
        left.occurredAt - right.occurredAt ||
        left.sourceIndex - right.sourceIndex,
    )
    .map(({ item }) => item);
}

function timestampOf(value: string | null | undefined): number {
  if (!value) return Number.MAX_SAFE_INTEGER;
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? Number.MAX_SAFE_INTEGER : timestamp;
}
