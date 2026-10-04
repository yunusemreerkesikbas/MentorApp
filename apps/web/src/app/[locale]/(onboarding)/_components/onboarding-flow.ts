import type { ExamType } from "@mentor/types";

export type OnboardingStep =
  | "intro"
  | "exam"
  | "kpssLevel"
  | "why"
  | "field"
  | "dailyGoal"
  | "coachProfile"
  | "profile"
  | "complete";

/**
 * Who the wizard is walking through it (APP-089). A coach keeps the exam question — reworded, it
 * asks which exam they coach — because `hasCompletedOnboarding` gates the whole `(app)` surface on
 * `username && examType`.
 */
export type OnboardingAudience = "student" | "coach";

/**
 * Walk order per audience. The username comes last, so nothing past the wizard opens before the
 * final question is saved. A coach is not asked why, which field or how long a day: those write a
 * student's goal board and study rhythm. The coach profile takes their place.
 */
const ORDER: Record<OnboardingAudience, readonly OnboardingStep[]> = {
  student: ["intro", "exam", "kpssLevel", "why", "field", "dailyGoal", "profile", "complete"],
  coach: ["intro", "exam", "kpssLevel", "coachProfile", "profile", "complete"],
};

function walk(
  step: OnboardingStep,
  examType: ExamType | null,
  audience: OnboardingAudience,
  direction: 1 | -1,
): OnboardingStep {
  const order = ORDER[audience];
  for (let i = order.indexOf(step) + direction; i >= 0 && i < order.length; i += direction) {
    const candidate = order[i];
    if (candidate && (candidate !== "kpssLevel" || examType === "KPSS")) return candidate;
  }
  return step;
}

export function nextOnboardingStep(
  step: OnboardingStep,
  examType: ExamType | null,
  audience: OnboardingAudience = "student",
): OnboardingStep {
  return walk(step, examType, audience, 1);
}

export function previousOnboardingStep(
  step: OnboardingStep,
  examType: ExamType | null,
  audience: OnboardingAudience = "student",
): OnboardingStep {
  return walk(step, examType, audience, -1);
}

/**
 * Progress bar position. Only questions count and completion owns the last segment, so the final
 * question never reads as finished. The KPSS level keeps its slot for every exam: a YKS student
 * jumps from 1 to 3 instead of watching the bar re-scale when the exam changes.
 */
export function onboardingProgress(
  step: OnboardingStep,
  audience: OnboardingAudience = "student",
): { done: number; total: number } | null {
  const questions: readonly OnboardingStep[] = ORDER[audience].filter((s) => s !== "intro" && s !== "complete");
  const index = questions.indexOf(step);
  return index === -1 ? null : { done: index + 1, total: questions.length + 1 };
}

/**
 * Where the wizard lets go.
 *
 * A coach lands on their own panel rather than the student dashboard: they just wrote a coach
 * profile, and dropping them into a study plan would be the same mismatch APP-089 fixed. A pending
 * invite still wins for a student, because they followed a link to get here.
 */
export function onboardingDestination(
  pendingInvite: string | null,
  audience: OnboardingAudience = "student",
): string {
  if (audience === "coach") return "/students";
  return pendingInvite ?? "/dashboard";
}
