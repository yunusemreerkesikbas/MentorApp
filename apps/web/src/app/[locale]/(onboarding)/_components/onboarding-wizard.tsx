"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ExamType } from "@mentor/types";
import { UserRole } from "@mentor/types";
import { useRouter } from "@/i18n/navigation";
import { trackProductEvent } from "@/lib/analytics";
import { useAuth } from "@/lib/auth-context";
import { hasCompletedOnboarding } from "@/lib/post-auth-destination";
import { OnboardingDirectionProvider } from "./onboarding-direction";
import {
  nextOnboardingStep,
  onboardingProgress,
  previousOnboardingStep,
  type OnboardingAudience,
  type OnboardingStep,
} from "./onboarding-flow";
import { CoachProfileStep } from "./steps/coach-profile-step";
import { CompleteStep, type ReadySummary } from "./steps/complete-step";
import { DailyGoalStep } from "./steps/daily-goal-step";
import { ExamStep } from "./steps/exam-step";
import { FieldStep } from "./steps/field-step";
import { IntroStep } from "./steps/intro-step";
import { KpssLevelStep } from "./steps/kpss-level-step";
import { ProfileStep } from "./steps/profile-step";
import { WhyStep, type MotivationKey } from "./steps/why-step";

const SESSION_KEY = "mentor_onboarding";

export function OnboardingWizard() {
  const { user } = useAuth();
  const router = useRouter();
  const completeTracked = useRef(false);
  const [step, setStep] = useState<OnboardingStep>("intro");
  const [direction, setDirection] = useState<1 | -1>(1);
  const [examType, setExamType] = useState<ExamType | null>(
    user?.examType ?? null,
  );
  const [motivation, setMotivation] = useState<MotivationKey | null>(null);
  const [visionWritten, setVisionWritten] = useState(false);
  const [summary, setSummary] = useState<ReadySummary>({
    dailyGoalMinutes: null,
    careerGroup: null,
    reminder: false,
  });

  /*
   * Which wizard this is, read off the real principal rather than a remembered intent (APP-089).
   * Signup with `intent: "COACH"` grants the role immediately and the guard re-reads roles on every
   * request, so `user.roles` is the live answer here, after a refresh, a new tab or a later login.
   */
  const audience: OnboardingAudience = user?.roles.includes(UserRole.COACH)
    ? "coach"
    : "student";

  useEffect(() => {
    if (user && !hasCompletedOnboarding(user)) {
      if (!sessionStorage.getItem(SESSION_KEY)) {
        sessionStorage.setItem(SESSION_KEY, "1");
        trackProductEvent("tutorial_begin", {});
      }
      return;
    }
    if (!sessionStorage.getItem(SESSION_KEY)) router.replace("/dashboard");
  }, [user, router]);

  const finishOnboarding = useCallback(() => {
    if (!completeTracked.current) {
      completeTracked.current = true;
      trackProductEvent("tutorial_complete", {});
    }
    sessionStorage.removeItem(SESSION_KEY);
  }, []);

  if (!user) return null;
  const go = (from: OnboardingStep, selectedExam = examType) => {
    setDirection(1);
    setStep(nextOnboardingStep(from, selectedExam, audience));
  };
  const back = (from: OnboardingStep) => {
    setDirection(-1);
    setStep(previousOnboardingStep(from, examType, audience));
  };
  const progress = onboardingProgress(step, audience);

  const screen = (() => {
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
              if (wrote) setVisionWritten(true);
              setSummary((current) => ({ ...current, careerGroup }));
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
            onSaved={(dailyGoalMinutes, reminder) => {
              setSummary((current) => ({
                ...current,
                dailyGoalMinutes,
                reminder: current.reminder || reminder,
              }));
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
            onFinish={finishOnboarding}
          />
        );
    }
  })();

  return (
    <OnboardingDirectionProvider value={direction}>
      {screen}
    </OnboardingDirectionProvider>
  );
}
