"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { motion, useReducedMotion } from "framer-motion";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import type {
  AchievementCelebrationDto,
  AchievementView,
} from "@mentor/types";
import { Button } from "@mentor/ui";

import {
  BADGE_EFFECT_CLIP_PATH,
  BADGE_LIGHT_SWEEPS,
  getAchievementCelebrationLayers,
} from "@/lib/achievement-celebration-sequence";
import {
  playAchievementChime,
  unlockAchievementChime,
} from "@/lib/achievement-sound";

import { AchievementArt } from "./achievement-art";

const AchievementConfetti = dynamic(
  () =>
    import("./achievement-confetti").then((module) => ({
      default: module.AchievementConfetti,
    })),
  { ssr: false },
);

const CONFETTI_FALLBACK_MS = 6_500;
const BADGE_REVEAL_MS = 3_500;

export function AchievementCelebration({
  celebration,
  busy,
  onClose,
}: {
  celebration: AchievementCelebrationDto;
  busy: boolean;
  onClose: () => void;
}) {
  const item = celebration.items[0];
  if (!item) return null;

  const celebrationKey = `${celebration.kind}:${celebration.items
    .map((achievement) => achievement.id)
    .join(":")}`;

  return (
    <AchievementCelebrationDialog
      key={celebrationKey}
      celebration={celebration}
      item={item}
      busy={busy}
      onClose={onClose}
    />
  );
}

function AchievementCelebrationDialog({
  celebration,
  item,
  busy,
  onClose,
}: {
  celebration: AchievementCelebrationDto;
  item: AchievementView;
  busy: boolean;
  onClose: () => void;
}) {
  const t = useTranslations("achievements");
  const reducedMotion = Boolean(useReducedMotion());
  const [confettiCompleted, setConfettiCompleted] = useState(reducedMotion);
  const [badgeRevealStarted, setBadgeRevealStarted] = useState(reducedMotion);
  const soundPlayedRef = useRef(false);
  const soundPlayPendingRef = useRef(false);
  const { showConfetti, showBadge } = getAchievementCelebrationLayers({
    reducedMotion,
    badgeRevealStarted,
    confettiCompleted,
  });
  const isBackfill = celebration.kind === "BACKFILL_SUMMARY";
  const finishConfetti = useCallback(() => {
    setBadgeRevealStarted(true);
    setConfettiCompleted(true);
  }, []);

  const tryPlayAchievementChime = useCallback(async () => {
    if (soundPlayedRef.current || soundPlayPendingRef.current) return;
    soundPlayPendingRef.current = true;
    try {
      const played = await playAchievementChime();
      if (played) soundPlayedRef.current = true;
    } finally {
      soundPlayPendingRef.current = false;
    }
  }, []);

  useEffect(() => {
    if (!showBadge || soundPlayedRef.current) return;
    void tryPlayAchievementChime();
  }, [showBadge, tryPlayAchievementChime]);

  useEffect(() => {
    const handleAudioUnlock = () => {
      void unlockAchievementChime().then((unlocked) => {
        if (unlocked && showBadge) void tryPlayAchievementChime();
      });
    };

    window.addEventListener("pointerdown", handleAudioUnlock, {
      capture: true,
      once: true,
    });
    window.addEventListener("keydown", handleAudioUnlock, {
      capture: true,
      once: true,
    });
    return () => {
      window.removeEventListener("pointerdown", handleAudioUnlock, {
        capture: true,
      });
      window.removeEventListener("keydown", handleAudioUnlock, {
        capture: true,
      });
    };
  }, [showBadge, tryPlayAchievementChime]);

  useEffect(() => {
    if (!showConfetti) return;
    const revealTimer = window.setTimeout(
      () => setBadgeRevealStarted(true),
      BADGE_REVEAL_MS,
    );
    const fallbackTimer = window.setTimeout(
      finishConfetti,
      CONFETTI_FALLBACK_MS,
    );
    return () => {
      window.clearTimeout(revealTimer);
      window.clearTimeout(fallbackTimer);
    };
  }, [finishConfetti, showConfetti]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !busy) onClose();
    }

    window.addEventListener("keydown", handleKeyDown, { capture: true });
    return () =>
      window.removeEventListener("keydown", handleKeyDown, { capture: true });
  }, [busy, onClose]);

  return (
    <motion.div
      className="fixed inset-0 z-[120] flex items-center justify-center overflow-hidden bg-black/70 p-4 backdrop-blur-md"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: reducedMotion ? 0.15 : 0.24, ease: "easeOut" }}
    >
      {showConfetti ? (
        <div
          role="status"
          className="pointer-events-none absolute inset-0 z-[2]"
          aria-label={t("celebration_eyebrow")}
        >
          <AchievementConfetti onComplete={finishConfetti} />
        </div>
      ) : null}

      {showBadge ? (
        <motion.section
          role="dialog"
          aria-modal="true"
          aria-labelledby="achievement-celebration-title"
          initial={
            reducedMotion
              ? { opacity: 0 }
              : { opacity: 0, scale: 0.68, y: 20, filter: "blur(8px)" }
          }
          animate={{ opacity: 1, scale: 1, y: 0, filter: "blur(0px)" }}
          transition={{
            duration: reducedMotion ? 0.15 : 0.62,
            ease: [0.16, 1, 0.3, 1],
          }}
          className="relative z-[1] w-full max-w-lg overflow-hidden rounded-[var(--radius-card)] bg-[var(--color-surface)] px-5 pb-6 pt-4 text-center shadow-[var(--shadow-card)] sm:px-8 sm:pb-8"
        >
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(circle_at_50%_45%,color-mix(in_srgb,var(--color-progress-track)_72%,transparent),transparent_68%)]"
          />

          <motion.div
            className="relative mx-auto aspect-square w-full max-w-80 overflow-hidden"
            initial={
              reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.82 }
            }
            animate={{ opacity: 1, scale: 1 }}
            transition={{
              duration: reducedMotion ? 0.15 : 0.5,
              delay: reducedMotion ? 0 : 0.08,
              ease: [0.16, 1, 0.3, 1],
            }}
          >
            {!reducedMotion ? (
              <motion.span
                aria-hidden
                className="absolute inset-[13%] bg-[var(--color-progress-track)] blur-2xl"
                style={{ clipPath: BADGE_EFFECT_CLIP_PATH }}
                initial={{ opacity: 0, scale: 0.72 }}
                animate={{
                  opacity: [0, 0.55, 0.08, 0.25, 0],
                  scale: [0.72, 1.08, 1.18, 1.26, 1.34],
                }}
                transition={{
                  duration: 1.55,
                  delay: 0.05,
                  times: [0, 0.3, 0.58, 0.76, 1],
                  ease: "easeOut",
                }}
              />
            ) : null}
            <AchievementArt
              artKey={item.artKey}
              alt=""
              priority
              className="relative z-[1] size-full object-contain"
            />
            {!reducedMotion ? (
              <span
                aria-hidden
                className="pointer-events-none absolute inset-[4%] z-[2] overflow-hidden"
                style={{ clipPath: BADGE_EFFECT_CLIP_PATH }}
              >
                {BADGE_LIGHT_SWEEPS.map((sweep) => (
                  <motion.span
                    key={sweep.delay}
                    className="absolute inset-y-0 w-20 -skew-x-12 bg-gradient-to-r from-transparent via-white/55 to-transparent blur-sm"
                    initial={{ left: "-35%", opacity: 0 }}
                    animate={{
                      left: "115%",
                      opacity: [0, sweep.peakOpacity, 0],
                    }}
                    transition={{
                      duration: sweep.duration,
                      delay: sweep.delay,
                      ease: [0.16, 1, 0.3, 1],
                    }}
                  />
                ))}
              </span>
            ) : null}
          </motion.div>

          <motion.div
            initial={
              reducedMotion ? { opacity: 0 } : { opacity: 0, y: 12 }
            }
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: reducedMotion ? 0.15 : 0.36,
              delay: reducedMotion ? 0 : 0.2,
              ease: [0.16, 1, 0.3, 1],
            }}
          >
            <p className="text-sm font-bold text-[var(--color-accent)]">
              {isBackfill
                ? t("history_eyebrow")
                : t(`celebration_items.${item.id}.eyebrow`)}
            </p>
            <h2
              id="achievement-celebration-title"
              className="mt-2 text-2xl font-extrabold text-[var(--color-main)] sm:text-3xl"
            >
              {isBackfill ? t("history_title") : item.title}
            </h2>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-[var(--color-secondary)]">
              {isBackfill
                ? t("history_body", { count: celebration.items.length })
                : t(`celebration_items.${item.id}.body`)}
            </p>
            <Button
              autoFocus
              className="mt-6 w-full"
              busy={busy}
              onClick={onClose}
            >
              {t("continue")}
            </Button>
          </motion.div>
        </motion.section>
      ) : null}
    </motion.div>
  );
}
