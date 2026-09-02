"use client";

import Image from "next/image";
import { ArrowLeft } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useTranslations } from "next-intl";
import { Button } from "@mentor/ui";
import { DashProgress } from "@/components/dash-progress";
import { PuhuImage, type PuhuVariant } from "@/components/puhu-image";
import { WELCOME_SCENE_ASSETS } from "@/lib/onboarding-assets";
import type { WelcomeSlideKey } from "./welcome-flow";
import { WelcomeIntroPuhu } from "./welcome-intro-puhu";

const TOTAL = 4;
const FALLBACK_VARIANT: Record<Exclude<WelcomeSlideKey, "intro">, PuhuVariant> = {
  coach: "encouraging",
  dailyStep: "proud",
  community: "host",
};

export function WelcomeSlideLayout({
  step,
  slideKey,
  title,
  subtitle,
  introComplete,
  onIntroComplete,
  transitioningToAuth,
  onBack,
  onSkip,
  skipLabel,
  primaryLabel,
  onPrimary,
  secondaryLabel,
  onSecondary,
}: {
  step: number;
  slideKey: WelcomeSlideKey;
  title: string;
  subtitle: string;
  introComplete: boolean;
  onIntroComplete: () => void;
  transitioningToAuth: boolean;
  onBack?: () => void;
  onSkip?: () => void;
  skipLabel: string;
  primaryLabel: string;
  onPrimary: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
}) {
  const t = useTranslations("welcome");
  const reduceMotion = useReducedMotion();
  const sceneSrc = slideKey === "intro" ? null : WELCOME_SCENE_ASSETS?.[slideKey];

  function finishIntro() {
    if (slideKey === "intro" && !introComplete) onIntroComplete();
  }

  return (
    <main
      className="min-h-dvh overflow-hidden px-5"
      style={{ backgroundColor: "var(--color-bg)" }}
      onPointerDownCapture={finishIntro}
      onKeyDownCapture={finishIntro}
    >
      <motion.div
        className={`mx-auto grid min-h-dvh w-full max-w-5xl grid-cols-1 transition-[grid-template-columns,gap] duration-300 lg:items-center ${transitioningToAuth ? "lg:grid-cols-[minmax(0,1fr)_23.4375rem] lg:gap-12" : "lg:grid-cols-1"}`}
        animate={transitioningToAuth ? { opacity: 0.96 } : { opacity: 1 }}
      >
        <section className="mx-auto flex min-h-dvh w-full max-w-md flex-col py-6 sm:py-8">
          <div className="flex h-11 shrink-0 items-center justify-between">
            {onBack ? (
              <button type="button" onClick={onBack} aria-label={t("back_aria")} className="flex min-h-11 min-w-11 items-center justify-center rounded-[var(--radius-card)] text-[var(--color-main)] focus-visible:outline-none focus-visible:ring-2">
                <ArrowLeft size={24} aria-hidden />
              </button>
            ) : <span className="min-w-11" aria-hidden />}
            {onSkip ? (
              <button type="button" onClick={onSkip} className="min-h-11 rounded-[var(--radius-control)] px-2 text-sm font-bold text-[var(--color-main)] focus-visible:outline-none focus-visible:ring-2">
                {skipLabel}
              </button>
            ) : null}
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={slideKey}
              className="flex flex-1 flex-col items-center justify-center py-5 text-center"
              initial={reduceMotion ? { opacity: 0 } : { opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={reduceMotion ? { opacity: 0 } : { opacity: 0, x: -20 }}
              transition={{ duration: reduceMotion ? 0.12 : 0.3, ease: "easeOut" }}
            >
              <div className="mb-6 flex h-64 w-full items-center justify-center sm:h-72">
                {slideKey === "intro" ? (
                  <WelcomeIntroPuhu completed={introComplete} onComplete={onIntroComplete} />
                ) : sceneSrc ? (
                  <div className="relative h-full w-full">
                    <Image src={sceneSrc} alt="" fill sizes="(max-width: 768px) 90vw, 448px" className="object-contain" aria-hidden />
                  </div>
                ) : (
                  <PuhuImage variant={FALLBACK_VARIANT[slideKey]} size={220} priority={step === 1} />
                )}
              </div>
              <motion.div animate={{ opacity: introComplete ? 1 : 0, y: introComplete ? 0 : 8 }} transition={{ duration: 0.25 }} aria-hidden={!introComplete}>
                <h1 className="text-2xl font-semibold leading-tight text-[var(--color-main)] sm:text-3xl" style={{ fontFamily: "var(--font-heading)" }}>{title}</h1>
                <p className="mx-auto mt-3 max-w-sm text-base leading-relaxed text-[var(--color-body)]" style={{ fontFamily: "var(--font-body)" }}>{subtitle}</p>
              </motion.div>
            </motion.div>
          </AnimatePresence>

          <div className="mt-auto w-full" aria-hidden={!introComplete}>
            <DashProgress step={step} total={TOTAL} ariaLabel={t("progress_aria", { current: step + 1, total: TOTAL })} />
            <div className="mt-6">
              <Button type="button" fullWidth disabled={!introComplete || transitioningToAuth} onClick={onPrimary}>{primaryLabel}</Button>
            </div>
            {secondaryLabel && onSecondary ? (
              <div className="mt-3"><Button type="button" fullWidth variant="secondary" disabled={transitioningToAuth} onClick={onSecondary}>{secondaryLabel}</Button></div>
            ) : null}
          </div>
        </section>
        {transitioningToAuth ? <div className="hidden h-[32rem] rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-card)] lg:block" aria-hidden /> : null}
      </motion.div>
    </main>
  );
}
