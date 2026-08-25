import type {
  AchievementCelebrationDto,
  AchievementCollectionDto,
  AchievementId,
  AchievementShowcaseView,
  AchievementSource,
  AchievementView,
} from "@mentor/types";
import {
  ACHIEVEMENT_DEFINITIONS,
  ACHIEVEMENT_DEFINITION_BY_ID,
} from "./achievement-definitions";

const SHOWCASE_ITEM_LIMIT = 3;
const CATALOGUE_POSITION = new Map(
  ACHIEVEMENT_DEFINITIONS.map((definition, index) => [definition.id, index]),
);

export interface EarnedAchievement {
  id: AchievementId;
  source: AchievementSource;
  earnedAt: Date;
}

interface BuildAchievementCollectionInput {
  ownerView: boolean;
  earned: EarnedAchievement[];
  longestStreak: number;
  translate: (key: string) => string;
}

export function buildAchievementCollection(
  input: BuildAchievementCollectionInput,
): AchievementCollectionDto {
  const earnedById = new Map(input.earned.map((entry) => [entry.id, entry]));
  const items: AchievementView[] = [];

  for (const definition of ACHIEVEMENT_DEFINITIONS) {
    const award = earnedById.get(definition.id);
    if (!input.ownerView && !award) continue;

    items.push({
      id: definition.id,
      title: input.translate(definition.titleKey),
      description: input.translate(definition.descriptionKey),
      unlockHint: input.translate(definition.unlockHintKey),
      artKey: definition.artKey,
      status: award ? "EARNED" : "LOCKED",
      earnedAt: award?.earnedAt.toISOString() ?? null,
      progress:
        input.ownerView && definition.progressTarget !== null
          ? {
              current: Math.min(input.longestStreak, definition.progressTarget),
              target: definition.progressTarget,
            }
          : null,
    });
  }

  if (!input.ownerView) {
    return { ownerView: false, items, summary: null };
  }

  const lockedItems = items.filter((item) => item.status === "LOCKED");
  let suggestedAchievementId: AchievementId | null = null;
  let bestProgressRatio = 0;

  for (const item of lockedItems) {
    if (!item.progress || item.progress.current <= 0) continue;

    const progressRatio = item.progress.current / item.progress.target;
    if (progressRatio > bestProgressRatio) {
      suggestedAchievementId = item.id;
      bestProgressRatio = progressRatio;
    }
  }

  suggestedAchievementId ??= lockedItems[0]?.id ?? null;

  return {
    ownerView: true,
    items,
    summary: {
      earnedCount: items.length - lockedItems.length,
      totalCount: items.length,
      suggestedAchievementId,
    },
  };
}

export function buildAchievementShowcase(input: {
  earned: EarnedAchievement[];
  translate: (key: string) => string;
}): AchievementShowcaseView {
  const canonicalEarned = input.earned.filter((award) =>
    ACHIEVEMENT_DEFINITION_BY_ID.has(award.id),
  );
  const items = [...canonicalEarned]
    .sort((left, right) => {
      const earnedAtDifference = right.earnedAt.getTime() - left.earnedAt.getTime();
      if (earnedAtDifference !== 0) return earnedAtDifference;
      return CATALOGUE_POSITION.get(left.id)! - CATALOGUE_POSITION.get(right.id)!;
    })
    .slice(0, SHOWCASE_ITEM_LIMIT)
    .map((award) => {
      const definition = ACHIEVEMENT_DEFINITION_BY_ID.get(award.id)!;
      return {
        id: definition.id,
        title: input.translate(definition.titleKey),
        description: input.translate(definition.descriptionKey),
        unlockHint: input.translate(definition.unlockHintKey),
        artKey: definition.artKey,
        status: "EARNED" as const,
        earnedAt: award.earnedAt.toISOString(),
        progress: null,
      };
    });

  return { earnedCount: canonicalEarned.length, items };
}

export function groupAchievementCelebrations(
  unseen: EarnedAchievement[],
  views: ReadonlyMap<AchievementId, AchievementView>,
): AchievementCelebrationDto[] {
  const backfill: AchievementView[] = [];
  const live: AchievementCelebrationDto[] = [];

  for (const award of unseen) {
    const view = views.get(award.id);
    if (!view) continue;
    if (award.source === "BACKFILL") backfill.push(view);
    else live.push({ kind: "ACHIEVEMENT", items: [view] });
  }

  return [
    ...(backfill.length > 0
      ? ([{ kind: "BACKFILL_SUMMARY", items: backfill }] as AchievementCelebrationDto[])
      : []),
    ...live,
  ];
}
