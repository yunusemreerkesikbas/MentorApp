"use client";

import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { useReducedMotion } from "framer-motion";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
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

/** How fast the copy gives way as the scene slides: 1 at the halfway point, back to 0 on arrival. */
const SLIP_RATE = 2.2;
/** How far the art trails the track, as a share of the slide width. */
const PARALLAX = "10%";

export function WelcomeCarousel() {
  const t = useTranslations("welcome");
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const rootRef = useRef<HTMLElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef(0);
  const stepRef = useRef<WelcomeStep>(0);
  /** Where a tap sent us; while it is set, the copy stays down until the scroll arrives. */
  const targetRef = useRef<WelcomeStep | null>(null);
  const [step, setStep] = useState<WelcomeStep>(0);
  const [authTarget, setAuthTarget] = useState<"/login" | "/signup" | null>(null);

  useEffect(() => () => window.cancelAnimationFrame(frameRef.current), []);

  /*
   * Both doors out of the welcome are known up front. Fetching them now is what makes the tap
   * instant: measured on a throttled phone, "Başlayalım" used to sit for 1.6 s loading the auth route.
   */
  useEffect(() => {
    router.prefetch("/signup");
    router.prefetch("/login");
  }, [router]);

  /*
   * One write per frame, straight to CSS variables: the scene parallax and the copy's fade follow
   * the finger without re-rendering React on every scroll event. `step` still changes, but only
   * once per slide — at the midpoint, where the copy is already invisible and the swap is unseen.
   */
  function writeProgress() {
    frameRef.current = 0;
    const track = trackRef.current;
    const root = rootRef.current;
    if (!track?.clientWidth || !root) return;
    const progress = track.scrollLeft / track.clientWidth;
    const target = targetRef.current;
    const anchor = target ?? Math.round(progress);
    const distance = Math.abs(progress - anchor);
    root.style.setProperty("--welcome-progress", progress.toFixed(3));
    root.style.setProperty("--welcome-slip", Math.min(1, distance * SLIP_RATE).toFixed(3));
    if (target !== null && distance < 0.02) targetRef.current = null;
    const settled = Math.min(Math.max(Math.round(progress), 0), WELCOME_SLIDES.length - 1) as WelcomeStep;
    const next = target !== null ? (distance < 0.5 ? target : stepRef.current) : settled;
    if (next !== stepRef.current) {
      stepRef.current = next;
      setStep(next);
    }
  }

  function handleScroll() {
    if (!frameRef.current) frameRef.current = window.requestAnimationFrame(writeProgress);
  }

  function goTo(next: WelcomeStep) {
    const track = trackRef.current;
    if (!track) return;
    targetRef.current = next;
    track.scrollTo({ left: next * track.clientWidth, behavior: reduceMotion ? "auto" : "smooth" });
    handleScroll();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === "ArrowRight") goTo(nextWelcomeStep(step));
    if (event.key === "ArrowLeft") goTo(previousWelcomeStep(step));
  }

  function openAuth(target: "/login" | "/signup") {
    if (authTarget) return;
    markWelcomeSeen();
    setAuthTarget(target);
    router.push(target);
  }

  const slide = WELCOME_SLIDES[step];
  const isLast = isFinalWelcomeStep(step);

  return (
    <main
      ref={rootRef}
      className="onboarding-play-theme flex min-h-dvh flex-col bg-[var(--color-bg)] lg:flex-row lg:items-center lg:justify-center lg:gap-24 lg:px-10 lg:py-8"
      style={{
        "--welcome-progress": 0,
        "--welcome-slip": 0,
        "--welcome-parallax": reduceMotion ? "0%" : PARALLAX,
      } as CSSProperties}
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
