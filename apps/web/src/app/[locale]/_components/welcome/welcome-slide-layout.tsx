"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import { motion, useReducedMotion } from "framer-motion";
import ArrowLeft from "lucide-react/dist/esm/icons/arrow-left.mjs";
import { Button } from "@mentor/ui";
import { DashProgress } from "@/components/dash-progress";
import type { PuhuVariant } from "@/components/puhu-image";
import { PuhuImage } from "@/components/puhu-image";
import { WelcomeHeroSlogan } from "./welcome-hero-slogan";

const TOTAL = 3;

/** Pre-auth welcome slide chrome — onboarding centered mode parity. */
export function WelcomeSlideLayout({
  step,
  title,
  titleLead,
  titleEmphasis,
  subtitle,
  mascot,
  heroSrc,
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
  /** Designed hero slogan — lead + pill emphasis (slide 1). */
  titleLead?: string;
  titleEmphasis?: string;
  subtitle: string;
  mascot: PuhuVariant;
  /** Soft-fade poster; when set, replaces small Puhu + uses designed slogan. */
  heroSrc?: string;
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
  const isHero = Boolean(heroSrc);
  const designedSlogan = Boolean(titleLead && titleEmphasis);

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
    <div className="relative z-10 flex h-11 shrink-0 items-center justify-between">
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
    <main
      className={`flex min-h-screen w-full flex-col ${isHero ? "px-0" : "px-5"}`}
      style={{ backgroundColor: "var(--color-bg)" }}
    >
      <motion.div
        className={`mx-auto flex w-full max-w-md flex-1 flex-col ${isHero ? "pb-8" : "px-0 py-8"}`}
        {...fade}
      >
        {isHero ? (
          <div className="relative w-full shrink-0 overflow-hidden px-5 pt-8">
            {topBar}
            <div
              className="relative -mx-5 mt-1 w-[calc(100%+2.5rem)] overflow-hidden"
              style={{ height: "min(52vh, 420px)" }}
            >
              <Image
                src={heroSrc!}
                alt=""
                fill
                priority
                sizes="(max-width: 448px) 100vw, 448px"
                className="object-cover object-[center_12%]"
                style={{
                  maskImage:
                    "linear-gradient(to bottom, #000 0%, #000 58%, transparent 100%)",
                  WebkitMaskImage:
                    "linear-gradient(to bottom, #000 0%, #000 58%, transparent 100%)",
                }}
              />
            </div>
            <div className="relative z-10 -mt-10 flex flex-col items-center px-1">
              {designedSlogan ? (
                <WelcomeHeroSlogan
                  lead={titleLead!}
                  emphasis={titleEmphasis!}
                  fullTitle={title}
                />
              ) : (
                <h1
                  className="text-center text-xl font-bold leading-snug tracking-[-0.02em] lg:text-2xl"
                  style={{ color: "var(--color-main)", fontFamily: "var(--font-heading)" }}
                >
                  {title}
                </h1>
              )}
              <p
                className="mt-4 max-w-sm text-center text-base leading-relaxed text-pretty"
                style={{ color: "var(--color-secondary)", fontFamily: "var(--font-body)" }}
              >
                {subtitle}
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="px-5">{topBar}</div>
            <div className="flex flex-1 flex-col items-center justify-center px-5">
              <div className="mb-5 flex justify-center">
                <PuhuImage variant={mascot} size={140} priority />
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
            </div>
          </>
        )}

        <div className={`mt-auto w-full ${isHero ? "px-5 pt-6" : "mt-6 px-5"}`}>
          <DashProgress
            step={step}
            total={TOTAL}
            ariaLabel={t("progress_aria", { current: step + 1, total: TOTAL })}
          />
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
