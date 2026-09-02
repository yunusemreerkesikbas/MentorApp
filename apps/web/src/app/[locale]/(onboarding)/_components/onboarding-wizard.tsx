"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ExamType } from "@mentor/types";
import { useRouter } from "@/i18n/navigation";
import { trackProductEvent } from "@/lib/analytics";
import { useAuth } from "@/lib/auth-context";
import { hasCompletedOnboarding } from "@/lib/post-auth-destination";
import { nextOnboardingStep, previousOnboardingStep, type OnboardingStep } from "./onboarding-flow";
import { AvatarStep } from "./steps/avatar-step";
import { CompleteStep } from "./steps/complete-step";
import { ExamStep } from "./steps/exam-step";
import { GoalStep } from "./steps/goal-step";
import { KpssLevelStep } from "./steps/kpss-level-step";
import { ProfileStep } from "./steps/profile-step";
import { WelcomeStep } from "./steps/welcome-step";

const SESSION_KEY = "mentor_onboarding";

export function OnboardingWizard() {
  const { user } = useAuth();
  const router = useRouter();
  const completeTracked = useRef(false);
  const [step, setStep] = useState<OnboardingStep>("intro");
  const [examType, setExamType] = useState<ExamType | null>(user?.examType ?? null);

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
  const next = (from: OnboardingStep, selectedExam = examType) => setStep(nextOnboardingStep(from, selectedExam));
  const back = (from: OnboardingStep) => setStep(previousOnboardingStep(from, examType));

  switch (step) {
    case "intro":
      return <WelcomeStep displayName={user.displayName} onContinue={() => next("intro")} />;
    case "username":
      return <ProfileStep user={user} onBack={() => back("username")} onSaved={() => next("username")} />;
    case "avatar":
      return <AvatarStep user={user} onBack={() => back("avatar")} onSaved={() => next("avatar")} onSkip={() => next("avatar")} />;
    case "exam":
      return <ExamStep user={user} onBack={() => back("exam")} onSaved={(selected) => { setExamType(selected); next("exam", selected); }} />;
    case "kpssLevel":
      return <KpssLevelStep user={user} onBack={() => back("kpssLevel")} onSaved={() => next("kpssLevel")} />;
    case "goal":
      return <GoalStep onBack={() => back("goal")} onSaved={() => next("goal")} onSkip={() => next("goal")} />;
    case "complete":
      return <CompleteStep onFinish={finishOnboarding} />;
  }
}
