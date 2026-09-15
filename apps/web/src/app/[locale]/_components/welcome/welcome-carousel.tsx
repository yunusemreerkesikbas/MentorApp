"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { useReducedMotion } from "framer-motion";
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
import { WelcomeSheet } from "./welcome-sheet";
import { WelcomeStage } from "./welcome-stage";

/** A smooth scroll fires many events; only the slide it comes to rest on counts. */
const SCROLL_SETTLE_MS = 90;

export function WelcomeCarousel() {
  const t = useTranslations("welcome");
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const trackRef = useRef<HTMLDivElement>(null);
  const settleTimer = useRef(0);
  const authTimer = useRef(0);
  const [step, setStep] = useState<WelcomeStep>(0);
  const [authTarget, setAuthTarget] = useState<"/login" | "/signup" | null>(null);

  useEffect(
    () => () => {
      window.clearTimeout(settleTimer.current);
      window.clearTimeout(authTimer.current);
    },
    [],
  );

  function goTo(next: WelcomeStep) {
    const track = trackRef.current;
    track?.scrollTo({ left: next * track.clientWidth, behavior: reduceMotion ? "auto" : "smooth" });
    setStep(next);
  }

  function handleScroll() {
    window.clearTimeout(settleTimer.current);
    settleTimer.current = window.setTimeout(() => {
      const track = trackRef.current;
      if (!track?.clientWidth) return;
      const index = Math.round(track.scrollLeft / track.clientWidth);
      setStep(Math.min(Math.max(index, 0), WELCOME_SLIDES.length - 1) as WelcomeStep);
    }, SCROLL_SETTLE_MS);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === "ArrowRight") goTo(nextWelcomeStep(step));
    if (event.key === "ArrowLeft") goTo(previousWelcomeStep(step));
  }

  function openAuth(target: "/login" | "/signup") {
    if (authTarget) return;
    markWelcomeSeen();
    setAuthTarget(target);
    authTimer.current = window.setTimeout(() => router.push(target), ONBOARDING_MOTION.authSplitMs);
  }

  const slide = WELCOME_SLIDES[step];
  const isLast = isFinalWelcomeStep(step);

  return (
    <main
      className="onboarding-play-theme flex min-h-dvh flex-col bg-[var(--color-bg)] lg:flex-row lg:items-center lg:justify-center lg:gap-24 lg:px-10 lg:py-8"
      onKeyDown={handleKeyDown}
    >
      <WelcomeStage
        step={step}
        still={Boolean(reduceMotion)}
        trackRef={trackRef}
        onScroll={handleScroll}
        skipLabel={t("skip")}
        onSkip={isLast ? undefined : () => goTo(welcomeSkipStep())}
      />
      <WelcomeSheet
        step={step}
        total={WELCOME_SLIDES.length}
        title={t(`${slide.copyKey}.title`)}
        subtitle={t(`${slide.copyKey}.subtitle`)}
        dotsLabel={t("progress_aria", { current: step + 1, total: WELCOME_SLIDES.length })}
        dotLabel={(index) => t("go_to_slide", { current: index + 1 })}
        onDot={(index) => goTo(index as WelcomeStep)}
        primaryLabel={isLast ? t("start") : t("continue")}
        onPrimary={isLast ? () => openAuth("/signup") : () => goTo(nextWelcomeStep(step))}
        secondaryLabel={isLast ? t("have_account") : undefined}
        onSecondary={isLast ? () => openAuth("/login") : undefined}
        leaving={authTarget !== null}
      />
    </main>
  );
}
