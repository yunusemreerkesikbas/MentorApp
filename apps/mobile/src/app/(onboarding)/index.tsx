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
import {
  ExamStep,
  IntroStep,
  KpssLevelStep,
} from "../../components/onboarding/exam-steps.js";
import {
  CoachProfileStep,
  CompleteStep,
  DailyGoalStep,
  ProfileStep,
  type ReadySummary,
} from "../../components/onboarding/goal-profile-steps.js";
import {
  FieldStep,
  WhyStep,
} from "../../components/onboarding/vision-steps.js";
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
    dailyGoalMinutes: user?.dailyFocusGoalMinutes ?? null,
    careerGroup: user?.careerGroup ?? null,
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
          onSkip={() => go("dailyGoal")}
          onSaved={(dailyGoalMinutes) => {
            setSummary((cur) => ({ ...cur, dailyGoalMinutes }));
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
