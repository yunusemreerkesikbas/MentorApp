import { coachingControllerGetVision, coachingControllerUpsertVision } from "@mentor/api-client";
import type { CareerGroup, VisionDto } from "@mentor/types";

/**
 * Writes the why + field answers to the goal board.
 *
 * The board's upsert replaces every field, and somebody re-entering onboarding may already have a
 * goal they wrote themselves, so an existing board is left alone: these answers are a starting
 * point, never an overwrite. `replaceOwn` skips that check when this same session wrote the board.
 * `goalTitle` is required, so a new board gets one derived from the answer, editable on the board.
 *
 * Resolves `true` when it wrote.
 */
export async function saveOnboardingVision(
  input: { goalTitle: string; careerGroup: CareerGroup | null; motivation: string | null },
  replaceOwn: boolean,
): Promise<boolean> {
  if (!replaceOwn) {
    const response = await coachingControllerGetVision();
    const existing = ((response as { data?: VisionDto | null })?.data ?? response) as VisionDto | null;
    if (existing?.goalTitle) return false;
  }
  await coachingControllerUpsertVision({ ...input, targetCity: null });
  return true;
}
