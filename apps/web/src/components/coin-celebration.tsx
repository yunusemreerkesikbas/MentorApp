"use client";

import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Sparkles, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { playCoinChime } from "@/lib/coin-sound";
import { CoinCelebrationVisual } from "./coin-celebration-visual";

export interface CoinCelebrationProps {
  amount: number;
  label?: string;
  onClose: () => void;
  autoDismissMs?: number;
}

type CelebrationStage = "blur" | "bg" | "coin" | "text";

/**
 * Full-screen sequential coin reward celebration:
 * Step 1 (0ms): Backdrop dims & golden radial glow expands.
 * Step 2 (60ms): coin-bg.svg single-shot particle burst appears in center.
 * Step 3 (160ms): 3D spinning Lottie coin pops in with golden glow & chime.
 * Step 4 (320ms): +X Coin typography, subtitle & primary CTA reveal beneath the coin.
 *
 * Designed with a 450ms click grace period to eliminate accidental dismisses.
 */
export function CoinCelebration({
  amount,
  label,
  onClose,
  autoDismissMs = 12000,
}: CoinCelebrationProps) {
  const t = useTranslations("economy");
  const reduceMotion = useReducedMotion();
  const titleId = useId();

  const [stage, setStage] = useState<CelebrationStage>("blur");
  const [canDismiss, setCanDismiss] = useState(Boolean(reduceMotion));
  const visibleStage: CelebrationStage = reduceMotion ? "text" : stage;

  // Grace period prevents accidental tap/click from immediate dismiss
  useEffect(() => {
    if (reduceMotion) return;
    const timer = setTimeout(() => setCanDismiss(true), 450);
    return () => clearTimeout(timer);
  }, [reduceMotion]);

  // Lock body scroll and register Escape listener
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && canDismiss) onClose();
    }
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [canDismiss, onClose]);

  // Snappy step-by-step timer choreography (<350ms total sequence)
  useEffect(() => {
    if (reduceMotion) {
      void playCoinChime();
      return;
    }

    const timerBg = setTimeout(() => {
      setStage("bg");
    }, 60);

    const timerCoin = setTimeout(() => {
      setStage("coin");
      void playCoinChime();
    }, 160);

    const timerText = setTimeout(() => {
      setStage("text");
    }, 320);

    return () => {
      clearTimeout(timerBg);
      clearTimeout(timerCoin);
      clearTimeout(timerText);
    };
  }, [reduceMotion]);

  // Optional auto-dismiss timer (0 disables auto-dismiss)
  useEffect(() => {
    if (autoDismissMs <= 0) return;
    const timer = setTimeout(() => {
      onClose();
    }, autoDismissMs);
    return () => clearTimeout(timer);
  }, [onClose, autoDismissMs]);

  if (typeof document === "undefined") return null;

  const showBgBurst = visibleStage === "bg" || visibleStage === "coin";
  const showCoin = visibleStage === "coin" || visibleStage === "text";
  const showText = visibleStage === "text";

  return createPortal(
    <motion.div
      className="fixed inset-0 z-[120] flex items-center justify-center select-none"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
    >
      {/* Full-screen backdrop blur & dark veil */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-black/75 backdrop-blur-md cursor-pointer"
        onClick={() => {
          if (canDismiss) onClose();
        }}
      />

      {/* Top-right prominent glassmorphic Close button */}
      <motion.button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          if (canDismiss) onClose();
        }}
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.8 }}
        transition={{ delay: reduceMotion ? 0 : 0.2, duration: 0.2 }}
        aria-label={t("celebration_close", { defaultValue: "Kapat" })}
        className="absolute top-5 right-5 sm:top-8 sm:right-8 z-30 flex size-10 sm:size-12 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 active:scale-95 text-white/80 hover:text-white border border-white/20 backdrop-blur-md transition-all cursor-pointer shadow-lg"
      >
        <X className="size-5 sm:size-6" />
      </motion.button>

      {/* Center celebration stage with stopPropagation to prevent accidental dismiss */}
      <div
        className="relative z-10 flex flex-col items-center justify-center -translate-y-8 sm:-translate-y-10 pointer-events-auto select-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 3D coin, glowing halo, and single-shot particle burst */}
        <CoinCelebrationVisual
          size="lg"
          showGlow={visibleStage !== "blur"}
          showBurst={showBgBurst}
          showCoin={showCoin}
          reduceMotion={Boolean(reduceMotion)}
        />

        {/* Text & CTA placed directly below the coin */}
        <div className="absolute top-[calc(100%+14px)] left-1/2 -translate-x-1/2 w-max max-w-[90vw] flex flex-col items-center">
          <AnimatePresence>
            {showText ? (
              <motion.div
                key="celebration-text-content"
                className="relative flex flex-col items-center text-center select-none"
                initial={
                  reduceMotion
                    ? { opacity: 0 }
                    : { opacity: 0, y: 16, scale: 0.85 }
                }
                animate={{
                  opacity: 1,
                  y: 0,
                  scale: 1,
                }}
                exit={{ opacity: 0, y: 10, scale: 0.9 }}
                transition={
                  reduceMotion
                    ? { duration: 0 }
                    : {
                        type: "spring",
                        stiffness: 420,
                        damping: 22,
                        mass: 0.8,
                      }
                }
              >
                {/* Soft ambient golden glow behind the text */}
                <div
                  className="absolute -inset-4 rounded-full blur-xl pointer-events-none opacity-50"
                  style={{
                    background:
                      "radial-gradient(ellipse at center, rgba(255, 215, 0, 0.55) 0%, rgba(255, 160, 0, 0.15) 60%, transparent 80%)",
                  }}
                  aria-hidden="true"
                />

                {/* +X Coin text wrapper with floating sparkle star */}
                <div className="relative inline-flex items-center justify-center">
                  <span
                    id={titleId}
                    className="relative z-10 text-4xl sm:text-5xl font-black tracking-tight"
                    style={{
                      fontFamily: "var(--font-heading)",
                      background:
                        "linear-gradient(180deg, #FFFFFF 0%, #FFE57F 25%, #FFD15C 60%, #FFA000 100%)",
                      WebkitBackgroundClip: "text",
                      WebkitTextFillColor: "transparent",
                      filter: "drop-shadow(0 4px 24px rgba(255, 199, 0, 0.65))",
                    }}
                  >
                    {t("celebration_coin_reward", { count: amount })}
                  </span>

                  {!reduceMotion ? (
                    <motion.div
                      initial={{ opacity: 0, scale: 0, rotate: -45 }}
                      animate={{ opacity: 1, scale: 1, rotate: 0 }}
                      transition={{ delay: 0.1, type: "spring", stiffness: 450, damping: 14 }}
                      className="absolute -top-3 -right-6 text-[#FFE57F] pointer-events-none"
                    >
                      <Sparkles className="size-5 sm:size-6 drop-shadow-[0_0_12px_rgba(255,220,0,0.8)]" />
                    </motion.div>
                  ) : null}
                </div>

                {/* Subtitle text */}
                <motion.div
                  initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1, duration: 0.25, ease: "easeOut" }}
                  className="mt-2 flex flex-col items-center gap-1 text-center max-w-[340px]"
                >
                  {label ? (
                    <span className="text-white/60 text-xs font-semibold uppercase tracking-wider">
                      {label}
                    </span>
                  ) : null}
                  <span className="text-white/90 text-sm sm:text-base font-medium tracking-normal drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)] text-balance">
                    {t("celebration_subtitle", {
                      defaultValue: "Emeklerine sağlık, coinlerin seninle!",
                    })}
                  </span>
                </motion.div>

                {/* Prominent primary CTA button */}
                <motion.button
                  type="button"
                  onClick={onClose}
                  initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.85, y: 8 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{ delay: reduceMotion ? 0 : 0.18, duration: 0.25 }}
                  className="mt-4.5 inline-flex items-center justify-center rounded-full px-8 py-2 text-sm font-black tracking-wide text-slate-950 transition-all cursor-pointer shadow-[0_4px_20px_rgba(255,199,0,0.45)] hover:brightness-110 active:scale-95"
                  style={{
                    fontFamily: "var(--font-heading)",
                    background:
                      "linear-gradient(180deg, #FFF176 0%, #FFD54F 50%, #FFA000 100%)",
                  }}
                >
                  {t("celebration_cta", { defaultValue: "Harika!" })}
                </motion.button>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>,
    document.body,
  );
}
