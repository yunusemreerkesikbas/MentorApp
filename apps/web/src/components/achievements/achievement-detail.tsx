"use client";

import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { X } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import type { AchievementView } from "@mentor/types";

import { AchievementArt } from "./achievement-art";

interface AchievementDetailProps {
  achievement: AchievementView;
  locale: string;
  onClose: () => void;
}

export function AchievementDetail({
  achievement,
  locale,
  onClose,
}: AchievementDetailProps) {
  const t = useTranslations("achievements");
  const earned = achievement.status === "EARNED";
  const shouldReduceMotion = Boolean(useReducedMotion());
  const dialogRef = useRef<HTMLElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== "Tab") return;

      const focusableElements = Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      );
      const firstFocusableElement = focusableElements[0];
      const lastFocusableElement = focusableElements.at(-1);

      if (!firstFocusableElement || !lastFocusableElement) {
        event.preventDefault();
        dialogRef.current?.focus();
        return;
      }

      const isMovingBeforeDialog =
        event.shiftKey && document.activeElement === firstFocusableElement;
      const isMovingAfterDialog =
        !event.shiftKey && document.activeElement === lastFocusableElement;
      if (!isMovingBeforeDialog && !isMovingAfterDialog) return;

      event.preventDefault();
      (event.shiftKey ? lastFocusableElement : firstFocusableElement).focus();
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousBodyOverflow;
    };
  }, [onClose]);

  return (
    <motion.div
      data-achievement-detail-backdrop
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-4 sm:items-center"
      role="presentation"
      onMouseDown={onClose}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: shouldReduceMotion ? 0.1 : 0.2 }}
    >
      <motion.section
        data-achievement-detail-surface
        ref={dialogRef}
        role="dialog"
        tabIndex={-1}
        aria-modal="true"
        aria-labelledby="achievement-detail-title"
        aria-describedby="achievement-detail-description"
        className="relative w-full max-w-md rounded-[var(--radius-card)] bg-[var(--color-surface)] p-6 text-center shadow-[var(--shadow-card)]"
        onMouseDown={(event) => event.stopPropagation()}
        initial={{
          opacity: 0,
          y: shouldReduceMotion ? 0 : 20,
          scale: shouldReduceMotion ? 1 : 0.98,
        }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{
          opacity: 0,
          y: shouldReduceMotion ? 0 : 12,
          scale: shouldReduceMotion ? 1 : 0.985,
        }}
        transition={{
          duration: shouldReduceMotion ? 0.1 : 0.2,
          ease: [0.22, 1, 0.36, 1],
        }}
      >
        <button
          ref={closeButtonRef}
          type="button"
          onClick={onClose}
          aria-label={t("close")}
          className="absolute right-3 top-3 grid size-11 place-items-center rounded-full text-[var(--color-secondary)] focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
        >
          <X size={20} />
        </button>
        <AchievementArt
          artKey={achievement.artKey}
          alt=""
          className={`mx-auto size-52 object-contain ${earned ? "" : "grayscale opacity-35"}`}
        />
        <p className="mt-2 text-xs font-bold uppercase tracking-wide text-[var(--color-accent)]">
          {earned ? t("earned") : t("how_to_earn")}
        </p>
        <h2
          id="achievement-detail-title"
          className="mt-1 text-xl font-bold text-[var(--color-main)]"
        >
          {achievement.title}
        </h2>
        <p
          id="achievement-detail-description"
          className="mt-2 text-sm leading-6 text-[var(--color-secondary)]"
        >
          {earned ? achievement.description : achievement.unlockHint}
        </p>
        {!earned && achievement.progress ? (
          <div className="mt-5 rounded-[var(--radius-card)] bg-[var(--color-soft)] p-4 text-left">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="font-bold text-[var(--color-main)]">
                {t("progress_label")}
              </span>
              <span className="tabular-nums text-[var(--color-secondary)]">
                {t("progress_days", {
                  current: achievement.progress.current,
                  target: achievement.progress.target,
                })}
              </span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--color-progress-track)]">
              <span
                className="block h-full rounded-full bg-[var(--color-accent)]"
                style={{
                  width: `${Math.min(
                    100,
                    (achievement.progress.current / achievement.progress.target) *
                      100,
                  )}%`,
                }}
              />
            </div>
          </div>
        ) : null}
        {earned && achievement.earnedAt ? (
          <p className="mt-3 text-xs text-[var(--color-secondary)]">
            {t("earned_on", {
              date: new Intl.DateTimeFormat(locale).format(
                new Date(achievement.earnedAt),
              ),
            })}
          </p>
        ) : null}
      </motion.section>
    </motion.div>
  );
}
