import { AchievementId } from "@mentor/types";

const ACHIEVEMENT_PREVIEW_IDS = new Set<AchievementId>(
  Object.values(AchievementId),
);

export function parseAchievementPreviewId(value: string | null): AchievementId | null {
  return value != null && ACHIEVEMENT_PREVIEW_IDS.has(value as AchievementId)
    ? (value as AchievementId)
    : null;
}
