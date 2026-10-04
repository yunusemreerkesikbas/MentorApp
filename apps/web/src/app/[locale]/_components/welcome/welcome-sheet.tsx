"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Button, StreamingText, TextsReveal } from "@mentor/ui";

/*
 * The copy is tied to the scroll, not to a timer: `--welcome-slip` is 0 on a settled slide and 1 at
 * the handover point, so the words give way as the scene slides and the swap lands while they are
 * invisible. `TextsReveal` stays mounted across slides so its blur/transform entrance does not
 * restart while the scroll-linked transform is still moving the copy.
 */
const SLIP_STYLE = {
  opacity: "calc(1 - var(--welcome-slip, 0))",
  transform: "translateY(calc(var(--welcome-slip, 0) * 10px))",
} as const;

/**
 * The copy half of the welcome: slide dots, the title that crossfades as slides settle, and the
 * CTAs. On the last slide "Devam et" becomes "Başlayalım" and lifts to make room for the account
 * button rising in below it.
 */
export function WelcomeSheet({
  step,
  total,
  title,
  subtitle,
  dotsLabel,
  dotLabel,
  onDot,
  primaryLabel,
  onPrimary,
  secondaryLabel,
  onSecondary,
  leaving,
}: {
  step: number;
  total: number;
  title: string;
  subtitle: string;
  dotsLabel: string;
  dotLabel: (index: number) => string;
  onDot: (index: number) => void;
  primaryLabel: string;
  onPrimary: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
  /** An auth route is already on its way; freeze the buttons. */
  leaving: boolean;
}) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.section
      className="relative z-10 -mt-7 flex flex-1 flex-col rounded-t-[var(--play-sheet-radius)] bg-[var(--color-bg)] px-6 pt-6 lg:mt-0 lg:w-[25rem] lg:flex-none lg:rounded-none lg:bg-transparent lg:p-0"
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduceMotion ? 0.12 : 0.45, ease: [0.22, 1, 0.36, 1], delay: reduceMotion ? 0 : 0.08 }}
    >
      <div role="group" aria-label={dotsLabel} className="-mx-[3px] flex items-center">
        {Array.from({ length: total }, (_, index) => (
          <button
            key={index}
            type="button"
            aria-label={dotLabel(index)}
            aria-current={index === step ? "step" : undefined}
            onClick={() => onDot(index)}
            className="flex h-6 items-center rounded-full px-[3px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
          >
            <span
              className={`block h-2 rounded-full transition-[width,background-color] duration-300 ease-out motion-reduce:transition-none ${index === step ? "w-6 bg-[var(--play-selected-ink)]" : "w-2 bg-[var(--play-line)]"}`}
            />
          </button>
        ))}
      </div>

      <div aria-live="polite" className="mt-3 lg:mt-5" style={SLIP_STYLE}>
        <TextsReveal
          className="flex flex-col gap-2 lg:gap-3"
          lines={[
            <h1
              key="title"
              className="text-balance text-[2rem] font-extrabold leading-tight tracking-[-0.02em] text-[var(--color-main)] lg:text-[2.5rem]"
            >
              {/* Only Puhu's own greeting streams; the other slides are narration and a half-written
                  headline is what a fast swiper would otherwise see. */}
              {step === 0 ? <StreamingText key={title} text={title} /> : title}
            </h1>,
            <p key="subtitle" className="text-pretty text-base font-medium leading-relaxed text-[var(--color-secondary)] lg:text-lg">
              {subtitle}
            </p>,
          ]}
        />
      </div>

      <div className="-mx-6 mt-auto flex flex-col gap-4 px-5 pb-[max(1.75rem,env(safe-area-inset-bottom))] pt-4 lg:mx-0 lg:mt-8 lg:w-[22.5rem] lg:p-0">
        <motion.div layout={!reduceMotion} transition={{ duration: 0.24, ease: "easeOut" }}>
          <Button fullWidth onClick={onPrimary} disabled={leaving}>
            {primaryLabel}
          </Button>
        </motion.div>
        <AnimatePresence initial={false}>
          {secondaryLabel && onSecondary ? (
            <motion.div
              key="secondary"
              initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.24, ease: "easeOut" }}
            >
              <Button fullWidth variant="secondary" onClick={onSecondary} disabled={leaving}>
                {secondaryLabel}
              </Button>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </motion.section>
  );
}
