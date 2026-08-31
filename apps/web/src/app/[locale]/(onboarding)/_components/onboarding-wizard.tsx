"use client";

import { useEffect, useRef, useState } from "react";
import type { ExamType } from "@mentor/types";
import { useRouter } from "@/i18n/navigation";
import { useAuth } from "@/lib/auth-context";
import { trackProductEvent } from "@/lib/analytics";
import { hasCompletedOnboarding } from "@/lib/post-auth-destination";
import { CompleteStep } from "./steps/complete-step";
import { ExamStep } from "./steps/exam-step";
import type { GoalSummary } from "./steps/goal-step";
import { GoalStep } from "./steps/goal-step";
import { ProfileStep } from "./steps/profile-step";
import { WelcomeStep } from "./steps/welcome-step";

type Step = 0 | 1 | 2 | 3 | 4;

const SESSION_KEY = "mentor_onboarding";

export function OnboardingWizard() {
  const { user } = useAuth();
  const router = useRouter();
  const completeTracked = useRef(false);
  const [step, setStep] = useState<Step>(0);
  const [examType, setExamType] = useState<ExamType | null>(
    user?.examType ?? null,
  );
  const [goal, setGoal] = useState<GoalSummary | null>(null);

  useEffect(() => {
    if (user && !hasCompletedOnboarding(user)) {
      if (!sessionStorage.getItem(SESSION_KEY)) {
        sessionStorage.setItem(SESSION_KEY, "1");
        trackProductEvent("tutorial_begin", {});
      }
      return;
    }
    if (!sessionStorage.getItem(SESSION_KEY)) {
      router.replace("/dashboard");
    }
  }, [user, router]);

  if (!user) return null;

  function finishOnboarding() {
    if (!completeTracked.current) {
      completeTracked.current = true;
      trackProductEvent("tutorial_complete", {});
    }
    sessionStorage.removeItem(SESSION_KEY);
  }

  if (step === 0) {
    return (
      <WelcomeStep
        displayName={user.displayName}
        onContinue={() => setStep(1)}
      />
    );
  }
  if (step === 1) {
    return (
      <ProfileStep
        user={user}
        onBack={() => setStep(0)}
        onSaved={() => setStep(2)}
      />
    );
  }
  if (step === 2) {
    return (
      <ExamStep
        user={user}
        onBack={() => setStep(1)}
        onSaved={(next) => {
          setExamType(next);
          setStep(3);
        }}
      />
    );
  }
  if (step === 3) {
    return (
      <GoalStep
        onBack={() => setStep(2)}
        onSaved={(summary) => {
          setGoal(summary);
          setStep(4);
        }}
        onSkip={() => setStep(4)}
      />
    );
  }
  if (step === 4 && examType) {
    return (
      <CompleteStep
        examType={examType}
        goal={goal}
        onBack={() => setStep(3)}
        onFinish={finishOnboarding}
      />
    );
  }

  return null;
}
