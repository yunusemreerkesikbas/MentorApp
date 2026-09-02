import type { ExamType } from "@mentor/types";

export type OnboardingStep =
  | "intro"
  | "username"
  | "avatar"
  | "exam"
  | "kpssLevel"
  | "goal"
  | "complete";

const PROGRESS_BY_STEP: Partial<Record<OnboardingStep, number>> = {
  username: 0,
  avatar: 1,
  exam: 2,
  kpssLevel: 3,
  goal: 4,
};

export function onboardingProgressStep(step: OnboardingStep): number | null {
  return PROGRESS_BY_STEP[step] ?? null;
}

export function nextOnboardingStep(
  step: OnboardingStep,
  examType: ExamType | null,
): OnboardingStep {
  switch (step) {
    case "intro":
      return "username";
    case "username":
      return "avatar";
    case "avatar":
      return "exam";
    case "exam":
      return examType === "KPSS" ? "kpssLevel" : "goal";
    case "kpssLevel":
      return "goal";
    case "goal":
      return "complete";
    case "complete":
      return "complete";
  }
}

export function previousOnboardingStep(
  step: OnboardingStep,
  examType: ExamType | null,
): OnboardingStep {
  switch (step) {
    case "intro":
      return "intro";
    case "username":
      return "intro";
    case "avatar":
      return "username";
    case "exam":
      return "avatar";
    case "kpssLevel":
      return "exam";
    case "goal":
      return examType === "KPSS" ? "kpssLevel" : "exam";
    case "complete":
      return "goal";
  }
}

export function onboardingDestination(pendingInvite: string | null): string {
  return pendingInvite ?? "/dashboard";
}
