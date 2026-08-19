import type { AchievementId } from "@mentor/types";

export const ACHIEVEMENT_IDS = [
  "first_step",
  "route_drawn",
  "dream_space_created",
  "rhythm_found",
  "rhythm_kept",
  "returned_to_path",
  "route_renewed",
  "starting_point_set",
  "mistake_revisited",
  "week_reflected",
  "first_hello",
  "helped_someone",
] as const satisfies readonly AchievementId[];

export interface AchievementDefinition {
  id: AchievementId;
  ruleVersion: 1;
  artKey: AchievementId;
  titleKey: `achievements.items.${AchievementId}.title`;
  descriptionKey: `achievements.items.${AchievementId}.description`;
  progressTarget: number | null;
}

function define(
  id: AchievementId,
  progressTarget: number | null = null,
): AchievementDefinition {
  return {
    id,
    ruleVersion: 1,
    artKey: id,
    titleKey: `achievements.items.${id}.title`,
    descriptionKey: `achievements.items.${id}.description`,
    progressTarget,
  };
}

export const ACHIEVEMENT_DEFINITIONS = [
  define("first_step"),
  define("route_drawn"),
  define("dream_space_created"),
  define("rhythm_found", 7),
  define("rhythm_kept", 30),
  define("returned_to_path"),
  define("route_renewed"),
  define("starting_point_set"),
  define("mistake_revisited"),
  define("week_reflected"),
  define("first_hello"),
  define("helped_someone"),
] as const satisfies readonly AchievementDefinition[];

export const ACHIEVEMENT_DEFINITION_BY_ID = new Map(
  ACHIEVEMENT_DEFINITIONS.map((definition) => [definition.id, definition]),
);
