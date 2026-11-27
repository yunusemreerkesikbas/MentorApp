import { coachingControllerGetVision, coachingControllerUpsertVision } from "@mentor/api-client";
import type { CareerGroup, VisionDto } from "@mentor/types";

/**
 * Writes the why + field answers to the goal board. An existing board the user wrote is left
 * alone; `replaceOwn` skips that check when this same session wrote it. Resolves `true` when it wrote.
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
