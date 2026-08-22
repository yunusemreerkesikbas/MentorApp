import { z } from "zod";

export const achievementIdSchema = z.enum([
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
]);

export const celebrateAchievementsSchema = z.object({
  achievementIds: z
    .array(achievementIdSchema)
    .min(1)
    .max(12)
    .refine((ids) => new Set(ids).size === ids.length, "Achievement ids must be unique"),
});

export type CelebrateAchievementsInput = z.infer<typeof celebrateAchievementsSchema>;

export const celebrateJourneyLevelSchema = z.object({
  celebrationId: z.string().uuid(),
});

export type CelebrateJourneyLevelInput = z.infer<typeof celebrateJourneyLevelSchema>;
