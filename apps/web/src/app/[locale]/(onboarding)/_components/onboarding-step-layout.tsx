"use client";

import { ArrowLeft } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { TextsReveal } from "@mentor/ui";
import { PlayProgress } from "@/components/onboarding-play/play-progress";
import { useOnboardingDirection } from "./onboarding-direction";

/**
 * One onboarding screen on the play surface (DESIGN.md §2.5): back · progress · skip, then the
 * question and its answers, then the step's sticky footer. Steps bring their own heading (Puhu
 * bubble or plain title) and footer, because both change shape between questions.
 */
export function OnboardingStepLayout({
  progress,
  onBack,
  skipLabel,
  onSkip,
  heading,
  children,
  footer,
  wide = false,
  root: Root = "main",
}: {
  progress: { done: number; total: number } | null;
  onBack?: () => void;
  skipLabel?: string;
  onSkip?: () => void;
  heading?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  /** The field grid opens to six columns on desktop. */
  wide?: boolean;
  /** Plan's coach brief reuses this screen over an existing page, so it is not a second main. */
  root?: "main" | "div";
}) {
  const t = useTranslations("onboarding");
  const reduceMotion = useReducedMotion();
  const direction = useOnboardingDirection();

  return (
    <Root
      className="onboarding-play-theme min-h-dvh w-full"
      style={{
        background:
          "radial-gradient(circle at 0% 0%, color-mix(in srgb, var(--blob-pink) 8%, transparent), transparent 34%), radial-gradient(circle at 100% 100%, color-mix(in srgb, var(--blob-blue) 9%, transparent), transparent 38%), var(--color-bg)",
      }}
    >
      <motion.div
        className={`mx-auto flex min-h-dvh w-full flex-col ${wide ? "max-w-xl lg:max-w-[65rem]" : "max-w-xl"}`}
        initial={reduceMotion ? { opacity: 0 } : { opacity: 0, x: 24 * direction }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: reduceMotion ? 0.12 : 0.25, ease: "easeOut" }}
      >
        <header className="mt-4 flex h-11 shrink-0 items-center gap-3 px-5">
          {onBack ? (
            <button
              type="button"
              onClick={onBack}
              aria-label={t("back_aria")}
              className="flex size-11 shrink-0 items-center justify-center rounded-[var(--play-radius)] text-[var(--color-secondary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
            >
              <ArrowLeft size={24} aria-hidden />
            </button>
          ) : (
            <span className="size-11 shrink-0" aria-hidden />
          )}
          <div className="flex-1">
            {progress ? (
              <PlayProgress
                done={progress.done}
                total={progress.total}
                label={t("progress_aria", { current: progress.done, total: progress.total })}
              />
            ) : null}
          </div>
          {onSkip && skipLabel ? (
            <button
              type="button"
              onClick={onSkip}
              className="min-h-11 shrink-0 rounded-[var(--play-radius)] px-1 text-base font-bold text-[var(--color-secondary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
            >
              {skipLabel}
            </button>
          ) : (
            <span className="size-11 shrink-0" aria-hidden />
          )}
        </header>

        <section className="flex flex-1 flex-col gap-6 px-5 pb-2 pt-5" data-onboarding-content>
          {heading}
          {children ? <TextsReveal lines={[<div key="content">{children}</div>]} /> : null}
        </section>
        {footer}
      </motion.div>
    </Root>
  );
}
