"use client";

import Image from "next/image";
import { ArrowLeft } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState, type FocusEvent, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@mentor/ui";
import { PUHU_MOTION_FRAMES } from "@/lib/onboarding-assets";
import { OnboardingProgress } from "./onboarding-progress";

export function OnboardingStepLayout({
  step,
  title,
  subtitle,
  children,
  primaryLabel,
  onPrimary,
  primaryBusy,
  primaryDisabled,
  primaryFormId,
  onBack,
  skipLabel,
  onSkip,
}: {
  step: number | null;
  title: string;
  subtitle?: string;
  mascot?: string;
  layout?: string;
  children?: ReactNode;
  primaryLabel?: string;
  onPrimary?: () => void;
  primaryBusy?: boolean;
  primaryDisabled?: boolean;
  primaryFormId?: string;
  onBack?: () => void;
  skipLabel?: string;
  onSkip?: () => void;
}) {
  const t = useTranslations("onboarding");
  const reduceMotion = useReducedMotion();
  const titleRef = useRef<HTMLHeadingElement>(null);
  const [speaking, setSpeaking] = useState(false);
  const [mouthClosed, setMouthClosed] = useState(false);
  const [blinking, setBlinking] = useState(false);
  const [lookingDown, setLookingDown] = useState(false);

  useEffect(() => {
    titleRef.current?.focus();
    if (reduceMotion) return;
    let mouthTimer = 0;
    let speechTimer = 0;
    let blinkTimer = 0;
    const frame = window.requestAnimationFrame(() => {
      setSpeaking(true);
      setMouthClosed(true);
      mouthTimer = window.setInterval(() => setMouthClosed((value) => !value), 150);
      speechTimer = window.setTimeout(() => {
        window.clearInterval(mouthTimer);
        setSpeaking(false);
        setBlinking(true);
      }, 900);
      blinkTimer = window.setTimeout(() => setBlinking(false), 1_060);
    });
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearInterval(mouthTimer);
      window.clearTimeout(speechTimer);
      window.clearTimeout(blinkTimer);
    };
  }, [title, reduceMotion]);

  function handleFocus(event: FocusEvent<HTMLElement>) {
    const target = event.target;
    setLookingDown(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLButtonElement);
  }

  return (
    <main
      className="min-h-dvh w-full px-4 sm:px-5"
      style={{
        background:
          "radial-gradient(circle at 0% 0%, color-mix(in srgb, var(--blob-pink) 8%, transparent), transparent 34%), radial-gradient(circle at 100% 100%, color-mix(in srgb, var(--blob-blue) 9%, transparent), transparent 38%), var(--color-bg)",
      }}
      onFocusCapture={handleFocus}
      onBlurCapture={() => setLookingDown(false)}
    >
      <motion.div
        className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col py-6 sm:py-8"
        initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: reduceMotion ? 0.12 : 0.3, ease: "easeOut" }}
      >
        <header className="flex min-h-11 items-center gap-3">
          {onBack ? (
            <button type="button" onClick={onBack} aria-label={t("back_aria")} className="flex min-h-11 min-w-11 items-center justify-center rounded-[var(--radius-card)] text-[var(--color-main)] focus-visible:outline-none focus-visible:ring-2">
              <ArrowLeft size={24} aria-hidden />
            </button>
          ) : <span className="min-w-11" aria-hidden />}
          {step !== null ? <div className="flex-1"><OnboardingProgress step={step} /></div> : <div className="flex-1" />}
          {onSkip && skipLabel ? (
            <button type="button" onClick={onSkip} className="min-h-11 rounded-[var(--radius-control)] px-2 text-sm font-bold text-[var(--color-main)] focus-visible:outline-none focus-visible:ring-2">{skipLabel}</button>
          ) : <span className="min-w-11" aria-hidden />}
        </header>

        <section className="mx-auto mt-5 flex w-full max-w-2xl items-start gap-3 sm:mt-6 sm:gap-5">
          <motion.div className="relative mt-1 size-[4.5rem] shrink-0 sm:size-28" animate={speaking && !reduceMotion ? { y: [0, -2, 0] } : { y: 0 }} transition={{ duration: 0.3, repeat: speaking ? 2 : 0 }}>
            <Image
              src={lookingDown ? PUHU_MOTION_FRAMES.lookDown : blinking ? PUHU_MOTION_FRAMES.blink : speaking && mouthClosed ? PUHU_MOTION_FRAMES.talkClosed : PUHU_MOTION_FRAMES.default}
              alt=""
              fill
              priority
              sizes="(max-width: 640px) 72px, 112px"
              className="object-contain"
              aria-hidden
            />
          </motion.div>
          <div className="relative min-w-0 flex-1 rounded-[var(--radius-card)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-card)] sm:p-5" aria-live="polite">
            <span className="absolute -left-2 top-8 size-4 rotate-45 bg-[var(--color-surface)]" aria-hidden />
            <motion.h1 ref={titleRef} tabIndex={-1} className="text-balance text-lg font-semibold leading-snug text-[var(--color-main)] outline-none sm:text-2xl" style={{ fontFamily: "var(--font-heading)" }} initial={reduceMotion ? undefined : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.24 }}>
              {title}
            </motion.h1>
            {subtitle ? <motion.p className="mt-2 text-sm leading-relaxed text-[var(--color-body)] sm:text-base" initial={reduceMotion ? undefined : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: reduceMotion ? 0 : 0.2, duration: 0.24 }}>{subtitle}</motion.p> : null}
          </div>
        </section>

        <section className="mt-6 flex flex-1 flex-col lg:mx-auto lg:w-full lg:max-w-xl lg:flex-none">{children}</section>
        {primaryLabel && (onPrimary || primaryFormId) ? (
          <div className="sticky bottom-0 mx-auto mt-6 w-full max-w-xl bg-[linear-gradient(to_bottom,transparent,var(--color-bg)_25%)] pb-[max(1rem,env(safe-area-inset-bottom))] pt-5 lg:static lg:bg-none lg:pb-0 lg:pt-0">
            <Button type={primaryFormId ? "submit" : "button"} form={primaryFormId} fullWidth busy={primaryBusy} disabled={primaryDisabled} onClick={primaryFormId ? undefined : onPrimary}>{primaryLabel}</Button>
          </div>
        ) : null}
      </motion.div>
    </main>
  );
}
