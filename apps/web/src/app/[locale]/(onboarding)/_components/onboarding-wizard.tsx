"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ExamType } from "@mentor/types";
import { UserRole } from "@mentor/types";
import { useRouter } from "@/i18n/navigation";
import { trackProductEvent } from "@/lib/analytics";
import { useAuth } from "@/lib/auth-context";
import { hasCompletedOnboarding } from "@/lib/post-auth-destination";
import {
  nextOnboardingStep,
  previousOnboardingStep,
  type OnboardingAudience,
  type OnboardingStep,
} from "./onboarding-flow";
import { AvatarStep } from "./steps/avatar-step";
import { CoachProfileStep } from "./steps/coach-profile-step";
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

  /*
   * Which wizard this is, read off the real principal rather than a remembered intent (APP-089).
   *
   * Signup with `intent: "COACH"` grants the role immediately, and the guard re-reads roles from the
   * database on every request, so `user.roles` is the live answer here and after a refresh, a new
   * tab, or a login days later. That is why no `?rol=koc` value has to survive the signup hop and
   * nothing is parked in session storage: the branch has a durable home.
   */
  const audience: OnboardingAudience = user?.roles.includes(UserRole.COACH) ? "coach" : "student";

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
  const next = (from: OnboardingStep, selectedExam = examType) =>
    setStep(nextOnboardingStep(from, selectedExam, audience));
  const back = (from: OnboardingStep) =>
    setStep(previousOnboardingStep(from, examType, audience));

  switch (step) {
    case "intro":
      return <WelcomeStep displayName={user.displayName} onContinue={() => next("intro")} />;
    case "username":
      return <ProfileStep user={user} onBack={() => back("username")} onSaved={() => next("username")} />;
    case "avatar":
      return <AvatarStep user={user} onBack={() => back("avatar")} onSaved={() => next("avatar")} onSkip={() => next("avatar")} />;
    case "exam":
      return <ExamStep user={user} audience={audience} onBack={() => back("exam")} onSaved={(selected) => { setExamType(selected); next("exam", selected); }} />;
    case "kpssLevel":
      return <KpssLevelStep user={user} onBack={() => back("kpssLevel")} onSaved={() => next("kpssLevel")} />;
    case "goal":
      return <GoalStep onBack={() => back("goal")} onSaved={() => next("goal")} onSkip={() => next("goal")} />;
    case "coachProfile":
      return <CoachProfileStep onBack={() => back("coachProfile")} onSaved={() => next("coachProfile")} />;
    case "complete":
      return <CompleteStep audience={audience} onFinish={finishOnboarding} />;
  }
}
