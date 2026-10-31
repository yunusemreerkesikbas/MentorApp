"use client";

import { useEffect } from "react";
import { Check, Lock, X } from "lucide-react";
import { motion } from "framer-motion";
import type { WeeklyReviewDto } from "@mentor/types";
import { PuhuImage } from "@/components/puhu-image";
import { Link } from "@/i18n/navigation";
import type { AccessState, NarrationState } from "./weekly-recap-shell";
import type { RecapTranslate } from "./weekly-recap-story";

export function PuhuNoteSheet({
  review,
  narration,
  access,
  unlockArmed,
  unlockBusy,
  onUnlock,
  onOpenPaywall,
  onClose,
  reducedMotion,
  t,
}: {
  review: WeeklyReviewDto;
  narration: NarrationState;
  access: AccessState;
  unlockArmed: boolean;
  unlockBusy: boolean;
  onUnlock: () => void;
  onOpenPaywall: () => void;
  onClose: () => void;
  reducedMotion: boolean;
  t: RecapTranslate;
}) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopImmediatePropagation();
      onClose();
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [onClose]);

  const lockedView =
    access.status === "ready" &&
    access.view.eligible &&
    !access.view.premium &&
    !access.view.unlocked
      ? access.view
      : null;
  const hasAi = narration.status === "ready";
  const unavailable =
    access.status === "ready" && !access.view.generationAvailable;

  return (
    <motion.div
      className="fixed inset-0 z-[90] flex items-end justify-center bg-black/55 px-3 backdrop-blur-sm md:items-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reducedMotion ? 0 : 0.2 }}
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onClose();
      }}
    >
      <motion.section
        data-weekly-recap-dialog
        role="dialog"
        aria-modal="true"
        aria-labelledby="weekly-recap-note-title"
        initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 42 }}
        animate={{ opacity: 1, y: 0 }}
        exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 32 }}
        transition={{ duration: reducedMotion ? 0 : 0.32 }}
        className="relative mb-3 w-full max-w-lg rounded-[var(--radius-card)] bg-[var(--color-surface)] px-6 pb-[max(24px,env(safe-area-inset-bottom))] pt-7 text-center shadow-2xl md:mb-0"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label={t("controls.close_note")}
          className="absolute right-3 top-3 inline-flex size-11 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--color-main)_5%,transparent)] text-[var(--color-main)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
        >
          <X className="size-5" aria-hidden />
        </button>
        <PuhuImage
          variant={hasAi ? "premium" : "encouraging"}
          size={132}
          priority
          className="mx-auto drop-shadow-lg"
        />
        <h2
          id="weekly-recap-note-title"
          className="mt-4 text-3xl font-black tracking-[-0.04em] text-[var(--color-main)]"
        >
          {t(hasAi ? "puhu_sheet.ai_title" : "puhu_sheet.title")}
        </h2>
        <p className="mt-4 text-pretty text-base font-bold leading-7 text-[var(--color-secondary)]">
          {hasAi ? narration.data.narration : review.recap.closingMessage}
        </p>
        {narration.status === "loading" ? (
          <p className="mt-3 text-sm font-bold text-[var(--color-secondary)]">
            {t("puhu_sheet.loading")}
          </p>
        ) : null}

        {unavailable && !hasAi && narration.status !== "loading" ? (
          <p
            role="status"
            className="mt-6 text-sm font-bold text-[var(--color-secondary)]"
          >
            {t("unlock.unavailable")}
          </p>
        ) : lockedView?.canAfford ? (
          <button
            type="button"
            aria-busy={unlockBusy || undefined}
            disabled={unlockBusy}
            onClick={onUnlock}
            className="mt-6 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-[var(--radius-card)] bg-[var(--color-accent-soft)] px-5 py-3 text-sm font-bold text-[var(--color-main)] transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] disabled:opacity-60"
          >
            {unlockArmed ? (
              <Check className="size-4" aria-hidden />
            ) : (
              <Lock className="size-4" aria-hidden />
            )}
            {unlockArmed
              ? t("unlock.confirm", { cost: lockedView.cost })
              : t("unlock.cta", { cost: lockedView.cost })}
          </button>
        ) : lockedView ? (
          <Link href="/settings" className={`${secondaryLinkClass} mt-6`}>
            {t("unlock.insufficient", {
              cost: lockedView.cost,
              balance: lockedView.coinConfirmed,
            })}
          </Link>
        ) : null}
        {lockedView && !unavailable ? (
          <button
            type="button"
            onClick={onOpenPaywall}
            className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-[var(--radius-card)] px-5 py-3 text-sm font-bold text-[var(--color-main)] underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
          >
            {t("unlock.premium")}
          </button>
        ) : null}
      </motion.section>
    </motion.div>
  );
}

const secondaryLinkClass =
  "inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[color-mix(in_srgb,var(--color-surface)_70%,transparent)] px-5 py-3 text-sm font-bold text-[var(--color-main)] shadow-[var(--shadow-card)] transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] motion-reduce:transition-none";
