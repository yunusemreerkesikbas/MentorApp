"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { ONBOARDING_MOTION } from "@/lib/onboarding-assets";
import { markWelcomeSeen } from "@/lib/welcome-seen";
import {
  WELCOME_SLIDES,
  isFinalWelcomeStep,
  nextWelcomeStep,
  previousWelcomeStep,
  welcomeSkipStep,
  type WelcomeStep,
} from "./welcome-flow";
import { WelcomeSlideLayout } from "./welcome-slide-layout";

export function WelcomeCarousel() {
  const t = useTranslations("welcome");
  const router = useRouter();
  const authTimer = useRef<number | null>(null);
  const [step, setStep] = useState<WelcomeStep>(0);
  const [introComplete, setIntroComplete] = useState(false);
  const [authTarget, setAuthTarget] = useState<"/login" | "/signup" | null>(null);

  useEffect(() => () => {
    if (authTimer.current) window.clearTimeout(authTimer.current);
  }, []);

  const completeIntro = useCallback(() => setIntroComplete(true), []);

  function openAuth(target: "/login" | "/signup") {
    if (authTarget) return;
    markWelcomeSeen();
    setAuthTarget(target);
    authTimer.current = window.setTimeout(() => router.push(target), ONBOARDING_MOTION.authSplitMs);
  }

  const slide = WELCOME_SLIDES[step];
  const isLast = isFinalWelcomeStep(step);

  return (
    <WelcomeSlideLayout
      step={step}
      slideKey={slide.key}
      title={t(`${slide.copyKey}.title`)}
      subtitle={t(`${slide.copyKey}.subtitle`)}
      introComplete={step !== 0 || introComplete}
      onIntroComplete={completeIntro}
      transitioningToAuth={authTarget !== null}
      onBack={step > 0 ? () => setStep(previousWelcomeStep(step)) : undefined}
      skipLabel={t("skip")}
      onSkip={() => setStep(welcomeSkipStep())}
      primaryLabel={isLast ? t("register") : t("continue")}
      onPrimary={isLast ? () => openAuth("/signup") : () => setStep(nextWelcomeStep(step))}
      secondaryLabel={isLast ? t("login") : undefined}
      onSecondary={isLast ? () => openAuth("/login") : undefined}
    />
  );
}
