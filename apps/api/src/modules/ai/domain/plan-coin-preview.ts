import { createHash } from "node:crypto";
import type { CoachPlanAdaptationInput } from "@mentor/validation";

export const PLAN_PREVIEW_WINDOW_MS = 24 * 60 * 60 * 1000;
/** Longer than provider timeouts; abandoned attempts never hold Coin. */
export const PLAN_PREVIEW_LEASE_MS = 5 * 60 * 1000;

export function planPreviewHash(
  input: Extract<CoachPlanAdaptationInput, { source: "PLAN" }>,
  locale: string,
): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        locale,
        source: input.source,
        note: input.note,
        days: input.days,
        minutesPerDay: input.minutesPerDay,
        studyWeekdays: input.studyWeekdays,
        focusSubjects: input.focusSubjects,
      }),
    )
    .digest("hex");
}
