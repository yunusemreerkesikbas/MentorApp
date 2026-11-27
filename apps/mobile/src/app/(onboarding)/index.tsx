import { useState } from "react";
import { Redirect, useRouter } from "expo-router";
import {
  nextOnboardingStep,
  onboardingProgress,
  previousOnboardingStep,
  type OnboardingAudience,
  type OnboardingMotivationKey,
  type OnboardingStep,
} from "@mentor/core";
import { UserRole, type ExamType } from "@mentor/types";
import { CoachProfileStep } from "../../components/onboarding/coach-profile-step.js";
import { DailyGoalStep } from "../../components/onboarding/daily-goal-step.js";
import { ProfileStep } from "../../components/onboarding/profile-step.js";
import { ExamStep } from "../../components/onboarding/exam-step.js";
import { IntroStep } from "../../components/onboarding/intro-step.js";
import { KpssLevelStep } from "../../components/onboarding/kpss-level-step.js";
import { CompleteStep, type ReadySummary } from "../../components/onboarding/complete-step.js";
import { FieldStep } from "../../components/onboarding/field-step.js";
import { WhyStep } from "../../components/onboarding/why-step.js";
import { useAuth } from "../../providers/auth-provider.js";
import { usePreferencesStore } from "../../stores/preferences.store.js";

/**
 * Multi-step exam-agnostic Onboarding Wizard (`AGENTS.md` §0):
 * - Uses the exact same `@mentor/core` step state machine (`nextOnboardingStep`, `previousOnboardingStep`, `onboardingProgress`)
 *   and backend endpoints (`/v1/users/me`, `/v1/coaching/vision`, `/v1/mentorship/coach-registration`) as `apps/web`.
 */
export default function OnboardingWizardScreen() {
  const router = useRouter();
  const { user, setUserFromServer } = useAuth();
  const setOnboardingCompleted = usePreferencesStore(
    (s) => s.setOnboardingCompleted,
  );

  const [step, setStep] = useState<OnboardingStep>("intro");
  const [examType, setExamType] = useState<ExamType | null>(
    user?.examType ?? null,
  );
  const [motivation, setMotivation] = useState<OnboardingMotivationKey | null>(
    null,
  );
  const [visionWritten, setVisionWritten] = useState(false);
  const [summary, setSummary] = useState<ReadySummary>({
    // Only what this run chose: a skipped goal step shows no goal row from an old value.
    dailyGoalMinutes: null,
    careerGroup: user?.careerGroup ?? null,
    reminder: false,
  });

  if (!user) {
    return <Redirect href="/(auth)/welcome" />;
  }

  const audience: OnboardingAudience = user.roles.includes(UserRole.COACH)
    ? "coach"
    : "student";

  const go = (from: OnboardingStep, selectedExam = examType) => {
    setStep(nextOnboardingStep(from, selectedExam, audience));
  };

  const back = (from: OnboardingStep) => {
    setStep(previousOnboardingStep(from, examType, audience));
  };

  const progress = onboardingProgress(step, audience);

  switch (step) {
    case "intro":
      return (
        <IntroStep
          displayName={user.displayName}
          onContinue={() => go("intro")}
        />
      );
    case "exam":
      return (
        <ExamStep
          user={user}
          audience={audience}
          progress={progress}
          onBack={() => back("exam")}
          onSaved={(selected) => {
            setExamType(selected);
            go("exam", selected);
          }}
        />
      );
    case "kpssLevel":
      return (
        <KpssLevelStep
          user={user}
          audience={audience}
          progress={progress}
          onBack={() => back("kpssLevel")}
          onSaved={() => go("kpssLevel")}
        />
      );
    case "why":
      return (
        <WhyStep
          progress={progress}
          initial={motivation}
          onBack={() => back("why")}
          onContinue={(answer) => {
            setMotivation(answer);
            go("why");
          }}
        />
      );
    case "field":
      return (
        <FieldStep
          progress={progress}
          examType={examType}
          motivation={motivation}
          initial={summary.careerGroup}
          replaceOwnVision={visionWritten}
          onBack={() => back("field")}
          onSaved={(careerGroup, wrote) => {
            if (wrote) {
              setVisionWritten(true);
              setUserFromServer({ ...user, careerGroup });
            }
            setSummary((cur) => ({ ...cur, careerGroup }));
            go("field");
          }}
        />
      );
    case "dailyGoal":
      return (
        <DailyGoalStep
          user={user}
          progress={progress}
          onBack={() => back("dailyGoal")}
          onSkip={() => {
            // Skipping after a save (back from profile) still drops the row: it shows what they chose to keep.
            setSummary((cur) => ({ ...cur, dailyGoalMinutes: null }));
            go("dailyGoal");
          }}
          onSaved={(dailyGoalMinutes, reminder) => {
            setSummary((cur) => ({ ...cur, dailyGoalMinutes, reminder }));
            go("dailyGoal");
          }}
        />
      );
    case "coachProfile":
      return (
        <CoachProfileStep
          progress={progress}
          onBack={() => back("coachProfile")}
          onSaved={() => go("coachProfile")}
        />
      );
    case "profile":
      return (
        <ProfileStep
          user={user}
          progress={progress}
          onBack={() => back("profile")}
          onSaved={() => go("profile")}
        />
      );
    case "complete":
      return (
        <CompleteStep
          user={user}
          audience={audience}
          summary={summary}
          onFinish={(destination) => {
            setOnboardingCompleted(true);
            router.replace(destination as never);
          }}
        />
      );
  }
}
