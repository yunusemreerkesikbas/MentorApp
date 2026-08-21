import type {
  AchievementCelebrationDto,
  AchievementCollectionDto,
  AchievementId,
  AchievementSource,
  AchievementView,
} from "@mentor/types";
import { ACHIEVEMENT_DEFINITIONS } from "./achievement-definitions";

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

  return { ownerView: input.ownerView, items };
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
