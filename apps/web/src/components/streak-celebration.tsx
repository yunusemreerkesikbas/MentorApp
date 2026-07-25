"use client";

import { useCallback, useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import { motion, useReducedMotion } from "framer-motion";
import { useLocale, useTranslations } from "next-intl";

import { formatWeekdayShort } from "@/app/[locale]/(app)/plan/_components/plan-utils";
import {
  celebrationWeekIsos,
  claimStreakCelebrationToday,
  didStreakCreditToday,
  isCelebrationDayLit,
} from "@/lib/streak-celebration";

type StreakCelebrationProps = {
  days: number;
  onClose: () => void;
};

const SHEET_GRADIENT =
  "linear-gradient(165deg, color-mix(in srgb, var(--color-streak) 88%, #9a3412) 0%, color-mix(in srgb, var(--color-streak) 72%, #c2410c) 48%, color-mix(in srgb, var(--color-streak-core) 55%, var(--color-streak)) 100%)";

function Sparkle({
  className,
  delay = 0,
  reduceMotion,
}: {
  className?: string;
  delay?: number;
  reduceMotion: boolean | null;
}) {
  return (
    <motion.span
      aria-hidden
      className={["pointer-events-none absolute text-white", className].join(" ")}
      initial={reduceMotion ? false : { opacity: 0, scale: 0.4 }}
      animate={
        reduceMotion
          ? { opacity: 0.9, scale: 1 }
          : {
              opacity: [0.35, 1, 0.45],
              scale: [0.75, 1.15, 0.85],
              rotate: [0, 18, -8],
            }
      }
      transition={
        reduceMotion
          ? { duration: 0 }
          : { duration: 2.2, delay, repeat: Infinity, ease: "easeInOut" }
      }
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 1.5 13.8 9.2 21.5 11 13.8 12.8 12 20.5 10.2 12.8 2.5 11 10.2 9.2 12 1.5Z" />
      </svg>
    </motion.span>
  );
}

/**
 * Mobile-first streak credit celebration (reference: peaked sheet + flame badge + week row).
 * Coin badge art TBD — fire-anime.svg is the hero for now.
 */
export function StreakCelebration({ days, onClose }: StreakCelebrationProps) {
  const t = useTranslations("panel");
  const locale = useLocale();
  const reduceMotion = useReducedMotion();
  const titleId = useId();
  const clipRawId = useId();
  const clipId = `streak-peak-${clipRawId.replace(/:/g, "")}`;
  // Streak window starts on the left (first active day → today), then future ghosts.
  const weekDays = celebrationWeekIsos(days).map((iso) => ({
    iso,
    label: formatWeekdayShort(iso, locale),
  }));

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const panel = (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center"
      role="presentation"
    >
      <motion.button
        type="button"
        aria-label={t("streak_celebration_dismiss")}
        className="absolute inset-0 bg-[color-mix(in_srgb,var(--color-main)_45%,transparent)] backdrop-blur-[2px]"
        initial={reduceMotion ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: reduceMotion ? 0 : 0.25 }}
        onClick={onClose}
      />

      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        initial={reduceMotion ? false : { opacity: 0, y: 56, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={
          reduceMotion
            ? { duration: 0 }
            : { type: "spring", stiffness: 380, damping: 28, mass: 0.85 }
        }
        className="relative z-[1] w-full max-w-md sm:px-4"
      >
        {/* objectBoundingBox clip: soft curved triangle peak (Habitify-style) */}
        <svg width={0} height={0} className="absolute" aria-hidden>
          <defs>
            <clipPath id={clipId} clipPathUnits="objectBoundingBox">
              <path d="M0,0.14 C0.08,0.14 0.18,0.13 0.28,0.08 C0.38,0.03 0.45,0.005 0.5,0 C0.55,0.005 0.62,0.03 0.72,0.08 C0.82,0.13 0.92,0.14 1,0.14 L1,1 L0,1 Z" />
            </clipPath>
          </defs>
        </svg>

        {/* Hero overlaps the peak */}
        <div className="pointer-events-none relative z-[2] mx-auto -mb-[52px] flex h-[128px] w-full max-w-[320px] justify-center">
          <motion.div
            className="absolute inset-x-0 top-2 mx-auto h-28 w-28 rounded-full opacity-50 blur-2xl"
            style={{
              background:
                "radial-gradient(circle, color-mix(in srgb, var(--color-streak-core) 80%, white) 0%, transparent 70%)",
            }}
            aria-hidden
            animate={
              reduceMotion
                ? undefined
                : { opacity: [0.35, 0.6, 0.4], scale: [0.9, 1.08, 0.95] }
            }
            transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
          />
          <Sparkle className="left-[18%] top-6" delay={0.2} reduceMotion={reduceMotion} />
          <Sparkle className="right-[16%] top-10" delay={0.7} reduceMotion={reduceMotion} />
          <motion.div
            className="relative h-[140px] w-[100px]"
            initial={reduceMotion ? false : { opacity: 0, y: 24, scale: 0.6 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={
              reduceMotion
                ? { duration: 0 }
                : { type: "spring", stiffness: 420, damping: 18, delay: 0.08 }
            }
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- animated SVG asset */}
            <img
              src={reduceMotion ? "/img/flame.png" : "/img/fire-anime.svg"}
              alt=""
              width={100}
              height={140}
              className="h-full w-full object-contain drop-shadow-[0_10px_24px_rgba(0,0,0,0.28)]"
              draggable={false}
            />
            <motion.span
              className="absolute -right-1 bottom-3 grid min-w-10 place-items-center rounded-full bg-white px-2 py-1 text-xl font-bold tabular-nums text-[var(--color-streak)] shadow-[var(--shadow-card)]"
              style={{ fontFamily: "var(--font-heading)" }}
              aria-hidden
              initial={reduceMotion ? false : { scale: 0, rotate: -12 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={
                reduceMotion
                  ? { duration: 0 }
                  : { type: "spring", stiffness: 500, damping: 16, delay: 0.28 }
              }
            >
              {days}
            </motion.span>
          </motion.div>
        </div>

        <div
          className="relative px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[4.25rem] shadow-[var(--shadow-card)] sm:pb-6"
          style={{
            background: SHEET_GRADIENT,
            clipPath: `url(#${clipId})`,
            WebkitClipPath: `url(#${clipId})`,
          }}
        >
          <div className="mx-auto flex w-full max-w-[320px] flex-col items-center text-center">
            <motion.h2
              id={titleId}
              className="text-2xl font-bold text-white text-balance"
              style={{ fontFamily: "var(--font-heading)" }}
              initial={reduceMotion ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: reduceMotion ? 0 : 0.35, delay: reduceMotion ? 0 : 0.22 }}
            >
              {t("streak_celebration_title", { days })}
            </motion.h2>

            <motion.div
              className="mt-5 flex w-full items-center justify-between gap-1"
              role="img"
              aria-label={t("metric_streak_value", { count: days })}
              initial="hidden"
              animate="show"
              variants={{
                hidden: {},
                show: {
                  transition: {
                    staggerChildren: reduceMotion ? 0 : 0.05,
                    delayChildren: reduceMotion ? 0 : 0.28,
                  },
                },
              }}
            >
              {weekDays.map((day, index) => {
                const lit = isCelebrationDayLit(index, days);
                return (
                  <motion.div
                    key={day.iso}
                    className="grid min-w-0 flex-1 justify-items-center gap-1.5"
                    variants={{
                      hidden: reduceMotion
                        ? { opacity: 1, y: 0, scale: 1 }
                        : { opacity: 0, y: 8, scale: 0.85 },
                      show: {
                        opacity: 1,
                        y: 0,
                        scale: 1,
                        transition: lit
                          ? { type: "spring", stiffness: 480, damping: 16 }
                          : { duration: 0.28 },
                      },
                    }}
                  >
                    <span
                      className={[
                        "grid size-9 place-items-center rounded-full",
                        lit
                          ? "bg-white shadow-[0_2px_10px_rgba(0,0,0,0.18)]"
                          : "bg-white/20",
                      ].join(" ")}
                      aria-hidden
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src="/img/flame.png"
                        alt=""
                        width={18}
                        height={18}
                        className={lit ? "opacity-100" : "opacity-35"}
                        draggable={false}
                      />
                    </span>
                    <span
                      className={[
                        "text-[10px] font-bold uppercase tracking-wide",
                        lit ? "text-white" : "text-white/55",
                      ].join(" ")}
                      aria-hidden
                    >
                      {day.label}
                    </span>
                  </motion.div>
                );
              })}
            </motion.div>

            <motion.button
              type="button"
              onClick={onClose}
              className="mt-7 flex min-h-11 w-full cursor-pointer items-center justify-center rounded-[var(--radius-card)] px-6 py-3 text-base font-bold shadow-[var(--shadow-card)] outline-none transition-opacity hover:opacity-95 focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-streak)] motion-reduce:transition-none"
              style={{
                backgroundColor: "white",
                color: "var(--color-streak)",
                fontFamily: "var(--font-body)",
              }}
              initial={reduceMotion ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: reduceMotion ? 0 : 0.3, delay: reduceMotion ? 0 : 0.45 }}
              whileTap={reduceMotion ? undefined : { scale: 0.98 }}
            >
              {t("streak_celebration_cta")}
            </motion.button>
          </div>
        </div>
      </motion.div>
    </div>
  );

  if (typeof document === "undefined") return null;
  return createPortal(panel, document.body);
}

/**
 * Call after a counting action when you know previous/next streak counts.
 * Opens the celebration at most once per local calendar day.
 */
export function useStreakCelebration() {
  const [days, setDays] = useState<number | null>(null);

  const tryCelebrate = useCallback((previousStreak: number, nextStreak: number) => {
    if (!didStreakCreditToday(previousStreak, nextStreak)) return;
    if (!claimStreakCelebrationToday()) return;
    setDays(nextStreak);
  }, []);

  /** Dev/QA only — skips the once-per-day gate (e.g. `?mockStreakCelebration=7`). */
  const previewCelebrate = useCallback((nextStreak: number) => {
    if (nextStreak < 1) return;
    setDays(nextStreak);
  }, []);

  const celebration =
    days != null ? (
      <StreakCelebration days={days} onClose={() => setDays(null)} />
    ) : null;

  return { tryCelebrate, previewCelebrate, celebration };
}
