"use client";

import { useEffect, useState } from "react";
import type { ExamType } from "@mentor/types";
import { useRouter } from "@/i18n/navigation";
import { useAuth } from "@/lib/auth-context";
import { CompleteStep } from "./steps/complete-step";
import { ExamStep } from "./steps/exam-step";
import type { GoalSummary } from "./steps/goal-step";
import { GoalStep } from "./steps/goal-step";
import { WelcomeStep } from "./steps/welcome-step";

type Step = 0 | 1 | 2 | 3;

const SESSION_KEY = "mentor_onboarding";

export function OnboardingWizard() {
  const { user } = useAuth();
  const router = useRouter();
  const [step, setStep] = useState<Step>(0);
  const [examType, setExamType] = useState<ExamType | null>(
    user?.examType ?? null,
  );
  const [goal, setGoal] = useState<GoalSummary | null>(null);

  useEffect(() => {
    if (!user?.examType) {
      sessionStorage.setItem(SESSION_KEY, "1");
      return;
    }
    if (!sessionStorage.getItem(SESSION_KEY)) {
      router.replace("/panel");
    }
  }, [user, router]);

  if (!user) return null;

  function finishOnboarding() {
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
      <ExamStep
        user={user}
        onBack={() => setStep(0)}
        onSaved={(next) => {
          setExamType(next);
          setStep(2);
        }}
      />
    );
  }
  if (step === 2) {
    return (
      <GoalStep
        onBack={() => setStep(1)}
        onSaved={(summary) => {
          setGoal(summary);
          setStep(3);
        }}
        onSkip={() => setStep(3)}
      />
    );
  }
  if (step === 3 && examType) {
    return (
      <CompleteStep
        examType={examType}
        goal={goal}
        onBack={() => setStep(2)}
        onFinish={finishOnboarding}
      />
    );
  }

  return null;
}
