"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { markWelcomeSeen } from "@/lib/welcome-seen";
import { WelcomeSlideLayout } from "./welcome-slide-layout";

const SLIDES = [
  {
    mascot: "encouraging" as const,
    copyKey: "slide1",
    heroSrc: "/visuals/welcome-hero.png",
    designedSlogan: true,
  },
  { mascot: "default" as const, copyKey: "slide2" },
  { mascot: "happy" as const, copyKey: "slide3" },
];

export function WelcomeCarousel() {
  const t = useTranslations("welcome");
  const router = useRouter();
  const [step, setStep] = useState(0);

  const slide = SLIDES[step];
  const isLast = step === SLIDES.length - 1;
  const designed = "designedSlogan" in slide && slide.designedSlogan;

  function handleSkip() {
    markWelcomeSeen();
    router.push("/login");
  }

  function handleRegister() {
    markWelcomeSeen();
    router.push("/signup");
  }

  function handleLogin() {
    markWelcomeSeen();
    router.push("/login");
  }

  return (
    <WelcomeSlideLayout
      step={step}
      mascot={slide.mascot}
      heroSrc={"heroSrc" in slide ? slide.heroSrc : undefined}
      title={t(`${slide.copyKey}.title`)}
      titleLead={designed ? t(`${slide.copyKey}.title_lead`) : undefined}
      titleEmphasis={designed ? t(`${slide.copyKey}.title_emphasis`) : undefined}
      subtitle={t(`${slide.copyKey}.subtitle`)}
      onBack={step > 0 ? () => setStep((s) => s - 1) : undefined}
      skipLabel={t("skip")}
      onSkip={handleSkip}
      primaryLabel={isLast ? t("register") : t("continue")}
      onPrimary={isLast ? handleRegister : () => setStep((s) => s + 1)}
      secondaryLabel={isLast ? t("login") : undefined}
      onSecondary={isLast ? handleLogin : undefined}
    />
  );
}
