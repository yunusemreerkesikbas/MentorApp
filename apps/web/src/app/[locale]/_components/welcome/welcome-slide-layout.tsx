"use client";

import { useTranslations } from "next-intl";
import { motion, useReducedMotion } from "framer-motion";
import ArrowLeft from "lucide-react/dist/esm/icons/arrow-left.mjs";
import { Button } from "@mentor/ui";
import { DashProgress } from "@/components/dash-progress";
import type { PuhuVariant } from "@/components/puhu-image";
import { PuhuImage } from "@/components/puhu-image";

const TOTAL = 3;

/** Pre-auth welcome slide chrome — onboarding centered mode parity. */
export function WelcomeSlideLayout({
  step,
  title,
  subtitle,
  mascot,
  onBack,
  onSkip,
  skipLabel,
  primaryLabel,
  onPrimary,
  secondaryLabel,
  onSecondary,
}: {
  step: number;
  title: string;
  subtitle: string;
  mascot: PuhuVariant;
  onBack?: () => void;
  onSkip?: () => void;
  skipLabel?: string;
  primaryLabel?: string;
  onPrimary?: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
}) {
  const t = useTranslations("welcome");
  const reduceMotion = useReducedMotion();

  const fade = reduceMotion
    ? {}
    : {
        initial: { opacity: 0, y: 10 },
        animate: {
          opacity: 1,
          y: 0,
          transition: { duration: 0.3, ease: "easeOut" as const },
        },
      };

  const topBar = (
    <div className="flex h-11 shrink-0 items-center justify-between">
      {onBack ? (
        <button
          type="button"
          onClick={onBack}
          aria-label={t("back_aria")}
          className="flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-[var(--radius-card)] transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 motion-reduce:transition-none"
          style={{ color: "var(--color-main)" }}
        >
          <ArrowLeft size={24} strokeWidth={2} aria-hidden />
        </button>
      ) : (
        <div className="min-w-11" aria-hidden />
      )}
      {onSkip && skipLabel ? (
        <button
          type="button"
          onClick={onSkip}
          className="min-h-11 cursor-pointer px-1 text-sm font-bold transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 motion-reduce:transition-none"
          style={{ color: "var(--color-main)", fontFamily: "var(--font-body)" }}
        >
          {skipLabel}
        </button>
      ) : (
        <div className="min-w-11" aria-hidden />
      )}
    </div>
  );

  return (
    <main className="flex min-h-screen w-full flex-col px-5">
      <motion.div
        className="mx-auto flex w-full max-w-md flex-1 flex-col py-8"
        {...fade}
      >
        {topBar}
        <div className="flex flex-1 flex-col items-center justify-center">
          <div className="mb-5 flex justify-center">
            <PuhuImage variant={mascot} size={140} />
          </div>
          <h1
            className="text-center text-xl font-semibold leading-snug lg:text-2xl"
            style={{ color: "var(--color-main)", fontFamily: "var(--font-heading)" }}
          >
            {title}
          </h1>
          <p
            className="mt-3 max-w-sm text-center text-base leading-relaxed"
            style={{ color: "var(--color-body)", fontFamily: "var(--font-body)" }}
          >
            {subtitle}
          </p>
          <div className="mt-6 w-full">
            <DashProgress
              step={step}
              total={TOTAL}
              ariaLabel={t("progress_aria", { current: step + 1, total: TOTAL })}
            />
          </div>
          {primaryLabel && onPrimary ? (
            <div className="mt-6 w-full">
              <Button type="button" fullWidth onClick={onPrimary}>
                {primaryLabel}
              </Button>
            </div>
          ) : null}
          {secondaryLabel && onSecondary ? (
            <div className="mt-3 w-full">
              <Button type="button" fullWidth variant="secondary" onClick={onSecondary}>
                {secondaryLabel}
              </Button>
            </div>
          ) : null}
        </div>
      </motion.div>
    </main>
  );
}
