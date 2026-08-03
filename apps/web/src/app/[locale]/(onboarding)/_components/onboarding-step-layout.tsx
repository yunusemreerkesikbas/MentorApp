"use client";
import { ArrowLeft } from "lucide-react";

import { useTranslations } from "next-intl";
import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";
import { Button } from "@mentor/ui";
import type { PuhuVariant } from "@/components/puhu-image";
import { PuhuImage } from "@/components/puhu-image";
import { OnboardingProgress } from "./onboarding-progress";

type LayoutMode = "centered" | "split";

/**
 * Mentor onboarding chrome — Nuton-inspired rhythm on DESIGN.md tokens.
 * `centered`: hero-only steps (welcome) — single column, viewport-centered.
 * `split`: form steps — mobile centered stack; desktop 2-col hero + card.
 */
export function OnboardingStepLayout({
  step,
  title,
  subtitle,
  mascot,
  children,
  layout,
  primaryLabel,
  onPrimary,
  primaryBusy,
  primaryDisabled,
  primaryFormId,
  onBack,
  skipLabel,
  onSkip,
}: {
  step: number;
  title: string;
  subtitle?: string;
  mascot: PuhuVariant;
  children?: ReactNode;
  layout?: LayoutMode;
  primaryLabel?: string;
  onPrimary?: () => void;
  primaryBusy?: boolean;
  primaryDisabled?: boolean;
  /** When set, primary button submits this form id (Enter key support). */
  primaryFormId?: string;
  onBack?: () => void;
  skipLabel?: string;
  onSkip?: () => void;
}) {
  const t = useTranslations("onboarding");
  const reduceMotion = useReducedMotion();
  const mode: LayoutMode = layout ?? (children ? "split" : "centered");

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
          className="-ms-2.5 flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-[var(--radius-card)] transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 motion-reduce:transition-none lg:ms-0"
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
          className="-me-1 min-h-11 cursor-pointer px-1 text-sm font-bold transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 motion-reduce:transition-none lg:me-0"
          style={{ color: "var(--color-main)", fontFamily: "var(--font-body)" }}
        >
          {skipLabel}
        </button>
      ) : (
        <div className="min-w-11" aria-hidden />
      )}
    </div>
  );

  const backControl = onBack ? (
    <button
      type="button"
      onClick={onBack}
      aria-label={t("back_aria")}
      className="-ms-2.5 flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-[var(--radius-card)] transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 motion-reduce:transition-none lg:ms-0"
      style={{ color: "var(--color-main)" }}
    >
      <ArrowLeft size={24} strokeWidth={2} aria-hidden />
    </button>
  ) : (
    <div className="min-h-11 min-w-11" aria-hidden />
  );

  const skipControl =
    onSkip && skipLabel ? (
      <button
        type="button"
        onClick={onSkip}
        className="-me-1 min-h-11 cursor-pointer px-1 text-sm font-bold transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 motion-reduce:transition-none lg:me-0"
        style={{ color: "var(--color-main)", fontFamily: "var(--font-body)" }}
      >
        {skipLabel}
      </button>
    ) : (
      <div className="min-h-11 min-w-11" aria-hidden />
    );

  const heroBlock = (
    <>
      <div
        className={
          mode === "centered"
            ? "mb-5 flex justify-center"
            : "mb-4 flex justify-center lg:mb-6 lg:justify-start"
        }
      >
        <PuhuImage
          variant={mascot}
          size={mode === "centered" ? 140 : 150}
          priority
        />
      </div>
      <h1
        className={
          mode === "centered"
            ? "text-center text-xl font-semibold leading-snug lg:text-2xl"
            : "text-center text-xl font-semibold leading-snug lg:text-left lg:text-2xl"
        }
        style={{ color: "var(--color-main)", fontFamily: "var(--font-heading)" }}
      >
        {title}
      </h1>
      {subtitle ? (
        <p
          className={
            mode === "centered"
              ? "mt-3 text-center text-base leading-relaxed"
              : "mt-3 max-w-sm text-center text-base leading-relaxed lg:max-w-md lg:text-left"
          }
          style={{ color: "var(--color-body)", fontFamily: "var(--font-body)" }}
        >
          {subtitle}
        </p>
      ) : null}
    </>
  );

  const progressBlock = (
    <div className="mt-6 w-full">
      <OnboardingProgress step={step} />
    </div>
  );

  const childrenBlock = children ? (
    <div
      className={
        mode === "centered"
          ? "mt-5 flex w-full flex-col gap-3"
          : "flex flex-col gap-4 rounded-[var(--radius-card)] p-5 lg:p-6"
      }
      style={
        mode === "centered"
          ? undefined
          : {
              backgroundColor: "rgba(255,255,255,0.55)",
              boxShadow: "var(--shadow-card)",
              border: "1px solid #ffffff",
            }
      }
    >
      {children}
    </div>
  ) : null;

  const ctaBlock =
    primaryLabel && (onPrimary || primaryFormId) ? (
      <div className="mt-6 w-full">
        <Button
          type={primaryFormId ? "submit" : "button"}
          form={primaryFormId}
          fullWidth
          busy={primaryBusy}
          disabled={primaryDisabled}
          onClick={primaryFormId ? undefined : onPrimary}
        >
          {primaryLabel}
        </Button>
      </div>
    ) : null;

  if (mode === "centered") {
    return (
      <main className="flex min-h-screen w-full flex-col px-5">
        <motion.div
          className="mx-auto flex w-full max-w-md flex-1 flex-col py-8"
          {...fade}
        >
          {topBar}
          <div className="flex flex-1 flex-col items-center justify-center">
            {heroBlock}
            {childrenBlock}
            {progressBlock}
            {ctaBlock}
          </div>
        </motion.div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen w-full flex-col px-5">
      <motion.div
        className="mx-auto flex w-full max-w-sm flex-1 flex-col py-8 lg:grid lg:max-w-none lg:w-fit lg:grid-cols-[17.5rem_22rem] lg:grid-rows-[auto_1fr] lg:content-start lg:gap-x-6 lg:gap-y-8 lg:py-10 xl:gap-x-8"
        {...fade}
      >
        {/* Mobile: single full-width top bar */}
        <div className="lg:hidden">{topBar}</div>

        {/* Desktop: back/skip sit in the same columns as hero/form */}
        <div className="hidden h-11 items-center justify-start lg:col-start-1 lg:row-start-1 lg:flex">
          {backControl}
        </div>
        <div className="hidden h-11 items-center justify-end lg:col-start-2 lg:row-start-1 lg:flex">
          {skipControl}
        </div>

        <div className="mt-6 flex flex-col items-center lg:col-start-1 lg:row-start-2 lg:mt-0 lg:items-start lg:self-center">
          {heroBlock}
        </div>

        <div className="mt-6 flex w-full flex-col lg:col-start-2 lg:row-start-2 lg:mt-0 lg:self-center">
          {childrenBlock}
          {progressBlock}
          {ctaBlock}
        </div>
      </motion.div>
    </main>
  );
}
