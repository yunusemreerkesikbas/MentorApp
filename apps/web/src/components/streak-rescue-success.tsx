"use client";

import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import { motion, useReducedMotion } from "framer-motion";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";

import { PuhuImage } from "@/components/puhu-image";

/** Draft img2vid clip — reuse until dedicated `puhu-streak-rescued` lands. */
export const STREAK_RESCUE_SUCCESS_VIDEO =
  "/video/character/puhu-streak-kept.mp4";

/** Hide draft watermark / bottom chrome by clipping the frame. */
const VIDEO_BOTTOM_CROP_PX = 40;

type StreakRescueSuccessProps = {
  /** Current streak days after rescue (celebration-style badge). */
  days: number;
  onClose: () => void;
};

/**
 * One-shot sheet after coin streak rescue — full-bleed looping Puhu video,
 * short title + reassurance overlaid, dismiss via × / backdrop / Escape.
 */
export function StreakRescueSuccess({
  days,
  onClose,
}: StreakRescueSuccessProps) {
  const t = useTranslations("panel");
  const reduceMotion = useReducedMotion();
  const titleId = useId();
  const [videoFailed, setVideoFailed] = useState(false);
  const showVideo = !reduceMotion && !videoFailed;
  const streakDays = Math.max(Math.floor(days), 1);

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
      className="fixed inset-0 z-[80] flex items-center justify-center p-4"
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
        initial={reduceMotion ? false : { opacity: 0, y: 40, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={
          reduceMotion
            ? { duration: 0 }
            : { type: "spring", stiffness: 380, damping: 28, mass: 0.85 }
        }
        className="relative z-[1] w-full max-w-sm overflow-hidden rounded-[var(--radius-card)] bg-[var(--color-surface)] ring-2 ring-[color-mix(in_srgb,var(--color-streak-core)_55%,white)]"
        style={{
          boxShadow:
            "var(--shadow-card), 0 0 0 6px color-mix(in srgb, var(--color-streak-soft) 70%, transparent), 0 12px 40px color-mix(in srgb, var(--color-streak) 28%, transparent)",
        }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label={t("streak_celebration_dismiss")}
          className="absolute right-2 top-2 z-[2] grid size-11 place-items-center rounded-full bg-[color-mix(in_srgb,var(--color-main)_40%,transparent)] text-white outline-none backdrop-blur-[2px] transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-white motion-reduce:transition-none"
        >
          <X size={20} strokeWidth={2.25} aria-hidden />
        </button>

        <div className="relative aspect-square w-full overflow-hidden bg-[color-mix(in_srgb,var(--color-streak-soft)_70%,var(--color-surface))]">
          {showVideo ? (
            <video
              src={STREAK_RESCUE_SUCCESS_VIDEO}
              autoPlay
              muted
              loop
              playsInline
              preload="auto"
              aria-hidden
              onError={() => setVideoFailed(true)}
              className="absolute inset-x-0 top-0 w-full object-cover object-top"
              style={{
                height: `calc(100% + ${VIDEO_BOTTOM_CROP_PX}px)`,
              }}
            />
          ) : (
            <div className="absolute inset-0 grid place-items-center">
              <PuhuImage variant="happy" size="lg" />
            </div>
          )}

          {/* Celebration-style streak chip: flame + days */}
          <motion.span
            className="absolute left-3 top-3 z-[2] inline-flex min-h-10 items-center gap-1 rounded-full bg-white py-1 pl-1.5 pr-2.5 text-xl font-bold tabular-nums text-[var(--color-streak)] shadow-[var(--shadow-card)]"
            style={{ fontFamily: "var(--font-heading)" }}
            aria-label={t("metric_streak_value", { count: streakDays })}
            initial={reduceMotion ? false : { scale: 0, rotate: -12 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={
              reduceMotion
                ? { duration: 0 }
                : { type: "spring", stiffness: 500, damping: 16, delay: 0.2 }
            }
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/img/flame.png"
              alt=""
              width={22}
              height={22}
              className="size-[22px] object-contain"
              draggable={false}
              aria-hidden
            />
            {streakDays}
          </motion.span>

          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 h-[55%] bg-gradient-to-t from-[color-mix(in_srgb,var(--color-main)_78%,transparent)] via-[color-mix(in_srgb,var(--color-main)_32%,transparent)] to-transparent"
          />

          <div className="absolute inset-x-0 bottom-0 px-5 pb-6 pt-10">
            <h2
              id={titleId}
              className="text-center text-2xl font-bold leading-snug text-white text-balance drop-shadow-[0_1px_8px_rgba(0,0,0,0.35)]"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              {t("streak_rescue_success_title")}
            </h2>
            <p
              className="mt-2 text-center text-sm leading-snug text-white/90 text-pretty drop-shadow-[0_1px_6px_rgba(0,0,0,0.3)]"
              style={{ fontFamily: "var(--font-body)" }}
            >
              {t("streak_rescue_success_message")}
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );

  if (typeof document === "undefined") return null;
  return createPortal(panel, document.body);
}
