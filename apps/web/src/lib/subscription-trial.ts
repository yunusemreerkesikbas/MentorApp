import type { PlanDto, TrialEligibilityDto } from "@mentor/types";

/** Present the backend's eligibility; phone verification completes an automatic trial. */
export function includesSubscriptionTrial(
  plan: Pick<PlanDto, "trialDays"> | undefined,
  eligibility: TrialEligibilityDto | undefined,
): boolean {
  return Boolean(plan && plan.trialDays > 0 && eligibility &&
    (eligibility.eligible || eligibility.reason === "PHONE_REQUIRED"));
}
