import type { ExamType } from "@mentor/types";

export type OnboardingStep =
  | "intro"
  | "username"
  | "avatar"
  | "exam"
  | "kpssLevel"
  | "goal"
  | "coachProfile"
  | "complete";

/**
 * Who the wizard is walking through it. A coach takes the same shape for four steps and then
 * diverges at the last one (APP-089).
 *
 * A coach used to have no branch at all: the only way to reach the coach application was to finish
 * the student wizard first, which meant picking a target exam and writing a personal goal sentence
 * ("Bu yolun sonunda ne var?") before being allowed to say they were a coach. The exam question
 * survives because it is genuinely theirs — reworded, it asks which exam they coach — and because
 * `hasCompletedOnboarding` gates the whole `(app)` surface on `username && examType`, so a coach
 * who skipped it could never reach their own profile screen.
 */
export type OnboardingAudience = "student" | "coach";

/** Steps that show a progress bar, per audience. `intro` and `complete` show none. */
const PROGRESS_ORDER: Record<OnboardingAudience, OnboardingStep[]> = {
  student: ["username", "avatar", "exam", "kpssLevel", "goal"],
  coach: ["username", "avatar", "exam", "kpssLevel", "coachProfile"],
};

export function onboardingProgressStep(
  step: OnboardingStep,
  audience: OnboardingAudience = "student",
): number | null {
  const index = PROGRESS_ORDER[audience].indexOf(step);
  return index === -1 ? null : index;
}

/**
 * How many dots the bar draws. The KPSS level step is conditional, so the count it produces is a
 * ceiling rather than a promise: a YKS student sees four of five fill. That was already true before
 * this branch existed, and inventing a per-exam total would make the bar jump when the exam changes.
 */
export function onboardingTotalSteps(audience: OnboardingAudience = "student"): number {
  return PROGRESS_ORDER[audience].length;
}

export function nextOnboardingStep(
  step: OnboardingStep,
  examType: ExamType | null,
  audience: OnboardingAudience = "student",
): OnboardingStep {
  const afterExam = audience === "coach" ? "coachProfile" : "goal";
  switch (step) {
    case "intro":
      return "username";
    case "username":
      return "avatar";
    case "avatar":
      return "exam";
    case "exam":
      return examType === "KPSS" ? "kpssLevel" : afterExam;
    case "kpssLevel":
      return afterExam;
    case "goal":
    case "coachProfile":
      return "complete";
    case "complete":
      return "complete";
  }
}

export function previousOnboardingStep(
  step: OnboardingStep,
  examType: ExamType | null,
  audience: OnboardingAudience = "student",
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
    case "coachProfile":
      return examType === "KPSS" ? "kpssLevel" : "exam";
    case "complete":
      return audience === "coach" ? "coachProfile" : "goal";
  }
}

/**
 * Where the wizard lets go.
 *
 * A coach lands on their own panel rather than the student dashboard: they just wrote a coach
 * profile, and dropping them into a study plan would be the same mismatch this branch exists to
 * fix. A pending invite still wins for a student, because they followed a link to get here.
 */
export function onboardingDestination(
  pendingInvite: string | null,
  audience: OnboardingAudience = "student",
): string {
  if (audience === "coach") return "/students";
  return pendingInvite ?? "/dashboard";
}
