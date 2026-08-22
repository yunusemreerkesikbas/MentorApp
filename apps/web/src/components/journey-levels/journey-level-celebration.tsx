"use client";

import { useEffect, useId, useRef } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import type {
  JourneyLevelCelebrationView,
  JourneyLevelChapterId,
  JourneyLevelKey,
} from "@mentor/types";
import { Button } from "@mentor/ui";

import { JourneyLevelMedallion } from "./journey-level-medallion";

type LevelCopyKey = `levels.${JourneyLevelKey}.${"name" | "story"}`;
type ChapterCopyKey = `chapters.${JourneyLevelChapterId}.label`;

interface JourneyLevelCelebrationProps {
  celebration: JourneyLevelCelebrationView;
  busy: boolean;
  error: string | null;
  onClose: () => void;
}

export function JourneyLevelCelebration({
  celebration,
  busy,
  error,
  onClose,
}: JourneyLevelCelebrationProps) {
  const t = useTranslations("journey_levels");
  const reduceMotion = Boolean(useReducedMotion());
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLElement | null>(null);
  const busyRef = useRef(busy);
  const closeRef = useRef(onClose);

  const levelName = t(`levels.${celebration.key}.name` as LevelCopyKey);
  const levelStory = t(`levels.${celebration.key}.story` as LevelCopyKey);
  const chapterLabel = t(
    `chapters.${celebration.chapter}.label` as ChapterCopyKey,
  );
  const isIntroduction = celebration.kind === "INTRODUCTION";

  useEffect(() => {
    busyRef.current = busy;
  }, [busy]);

  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogRef.current
      ?.querySelector<HTMLElement>("[data-journey-celebration-cta]")
      ?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (!busyRef.current) {
          event.preventDefault();
          closeRef.current();
        }
        return;
      }
      if (event.key !== "Tab") return;

      const focusable = Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      );
      const first = focusable[0];
      const last = focusable.at(-1);
      if (!first || !last) {
        event.preventDefault();
        dialogRef.current?.focus();
        return;
      }
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousBodyOverflow;
      window.requestAnimationFrame(() => previousFocus?.focus());
    };
  }, []);

  useEffect(() => {
    if (!error || busy) return;
    dialogRef.current
      ?.querySelector<HTMLElement>("[data-journey-celebration-cta]")
      ?.focus();
  }, [busy, error]);

  const requestClose = () => {
    if (!busy) onClose();
  };

  return (
    <motion.div
      data-journey-level-celebration-backdrop
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) requestClose();
      }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reduceMotion ? 0.12 : 0.22, ease: "easeOut" }}
    >
      <motion.section
        ref={dialogRef}
        role="dialog"
        tabIndex={-1}
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        aria-busy={busy}
        className="relative w-full max-w-md overflow-hidden rounded-[var(--radius-card)] border border-[color-mix(in_srgb,var(--color-progress)_22%,transparent)] bg-[var(--color-surface)] px-5 pb-6 pt-5 text-center shadow-[var(--shadow-card)] sm:px-8 sm:pb-8"
        onMouseDown={(event) => event.stopPropagation()}
        initial={
          reduceMotion
            ? { opacity: 0 }
            : { opacity: 0, scale: 0.96, y: 12 }
        }
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={
          reduceMotion
            ? { opacity: 0 }
            : { opacity: 0, scale: 0.98, y: 8 }
        }
        transition={{
          duration: reduceMotion ? 0.12 : 0.28,
          ease: [0.22, 1, 0.36, 1],
        }}
      >
        <button
          type="button"
          disabled={busy}
          onClick={requestClose}
          aria-label={t("close")}
          className="absolute right-2 top-2 z-[2] grid size-11 place-items-center rounded-full text-[var(--color-secondary)] transition-colors hover:bg-[color-mix(in_srgb,var(--color-btn-label)_10%,transparent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <X size={20} aria-hidden="true" />
        </button>

        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(circle_at_50%_42%,color-mix(in_srgb,var(--color-progress)_20%,transparent),transparent_68%)]"
        />

        <div className="relative mx-auto mt-4 grid size-40 place-items-center sm:size-48">
          {!reduceMotion ? (
            <motion.span
              aria-hidden
              className="absolute inset-3 rounded-full border border-[color-mix(in_srgb,var(--color-progress)_62%,transparent)]"
              initial={{ opacity: 0.58, scale: 0.7 }}
              animate={{ opacity: 0, scale: 1.38 }}
              transition={{ duration: 1.15, ease: "easeOut" }}
            />
          ) : null}
          <motion.div
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: reduceMotion ? 0.12 : 0.38, ease: "easeOut" }}
          >
            <JourneyLevelMedallion
              tier={celebration.tier}
              levelKey={celebration.key}
              current
              className="size-36 sm:size-44"
            />
          </motion.div>
        </div>

        <div className="relative mt-3">
          <p className="text-sm font-bold text-[var(--color-accent)]">
            {t(
              isIntroduction
                ? "celebration.introduction_eyebrow"
                : "celebration.level_up_eyebrow",
            )}
          </p>
          <h2
            id={titleId}
            className="mt-2 text-2xl font-extrabold text-[var(--color-main)] sm:text-3xl"
          >
            {t("level_title", { tier: celebration.tier, name: levelName })}
          </h2>
          <p className="mt-2 text-xs font-bold uppercase tracking-[0.12em] text-[var(--color-secondary)]">
            {chapterLabel}
          </p>
          <p
            id={descriptionId}
            className="mx-auto mt-3 max-w-sm text-sm leading-6 text-[var(--color-secondary)]"
          >
            {levelStory}
          </p>

          {error ? (
            <p
              role="alert"
              className="mt-4 rounded-[var(--radius-input)] bg-[color-mix(in_srgb,var(--color-danger)_10%,transparent)] px-3 py-2 text-sm text-[var(--color-danger)]"
            >
              {error}
            </p>
          ) : null}

          <Button
            data-journey-celebration-cta
            className="mt-6 w-full"
            busy={busy}
            onClick={requestClose}
          >
            {t("celebration.continue")}
          </Button>
        </div>
      </motion.section>
    </motion.div>
  );
}
