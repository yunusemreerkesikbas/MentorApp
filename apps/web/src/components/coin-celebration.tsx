"use client";

import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { DotLottieReact } from "@lottiefiles/dotlottie-react";
import { Sparkles, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { playCoinChime } from "@/lib/coin-sound";

export interface CoinCelebrationProps {
  amount: number;
  label?: string;
  onClose: () => void;
  autoDismissMs?: number;
}

type CelebrationStage = "blur" | "bg" | "coin" | "text";

/**
 * Full-screen sequential coin reward celebration:
 * Step 1: Backdrop dims and blurs the screen.
 * Step 2: coin-bg.svg single-shot particle burst appears in center (plays once).
 * Step 3: coin.json 3D spinning Lottie coin pops in with golden glow & chime.
 * Step 4: +X Coin typography and labels reveal beneath the coin with spring effects.
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
  // Unique cache-buster so SVG SMIL timeline starts fresh at 0s on mount
  const [renderKey] = useState(() => Date.now());

  // Step-by-step progression: "blur" -> "bg" -> "coin" -> "text"
  const [stage, setStage] = useState<CelebrationStage>(() =>
    reduceMotion ? "text" : "blur",
  );

  // Lock body scroll and register Escape listener
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

  // Step-by-step timer choreography
  useEffect(() => {
    if (reduceMotion) {
      setStage("text");
      void playCoinChime();
      return;
    }

    // Step 1 -> Step 2: Show coin-bg burst after blur has settled (400ms)
    const timerBg = setTimeout(() => {
      setStage("bg");
    }, 400);

    // Step 2 -> Step 3: Show coin after coin-bg single burst has peaked (1450ms)
    const timerCoin = setTimeout(() => {
      setStage("coin");
      void playCoinChime();
    }, 1450);

    // Step 3 -> Step 4: Show texts after coin has landed and settled (2100ms)
    const timerText = setTimeout(() => {
      setStage("text");
    }, 2100);

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

  // Single-shot burst only active during "bg" and initial "coin" entrance
  const showBgBurst = stage === "bg" || stage === "coin";
  const showCoin = stage === "coin" || stage === "text";
  const showText = stage === "text";

  const content = (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center select-none"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      {/* Step 1: Full-screen backdrop blur & dark veil - clicking anywhere dismisses */}
      <motion.div
        aria-hidden="true"
        className="absolute inset-0 bg-black/70 backdrop-blur-md cursor-pointer"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: reduceMotion ? 0 : 0.35, ease: "easeOut" }}
        onClick={onClose}
      />

      {/* Top-right prominent glassmorphic Close button */}
      <motion.button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.8 }}
        transition={{ delay: reduceMotion ? 0 : 0.4, duration: 0.25 }}
        aria-label={t("celebration_close", { defaultValue: "Kapat" })}
        className="absolute top-5 right-5 sm:top-8 sm:right-8 z-30 flex size-10 sm:size-12 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 active:scale-95 text-white/80 hover:text-white border border-white/20 backdrop-blur-md transition-all cursor-pointer shadow-lg"
      >
        <X className="size-5 sm:size-6" />
      </motion.button>

      {/* Center celebration stage with optical centering */}
      <div
        className="relative z-10 flex flex-col items-center justify-center -translate-y-8 sm:-translate-y-10 cursor-pointer pointer-events-auto select-none"
        onClick={onClose}
      >
        {/* Soft golden ambient radial glow behind everything */}
        {stage !== "blur" ? (
          <motion.div
            className="absolute size-72 sm:size-88 rounded-full blur-3xl opacity-45 pointer-events-none"
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 0.45, scale: 1 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            style={{
              background:
                "radial-gradient(circle, rgba(255, 199, 0, 0.45) 0%, rgba(255, 160, 0, 0.15) 50%, transparent 75%)",
            }}
            aria-hidden="true"
          />
        ) : null}

        {/* Step 2: coin-bg.svg burst animation (single-shot, plays once and exits) */}
        <AnimatePresence>
          {showBgBurst ? (
            <motion.div
              key="coin-bg-burst"
              className="pointer-events-none absolute flex items-center justify-center"
              initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, transition: { duration: 0.4 } }}
              transition={
                reduceMotion
                  ? { duration: 0 }
                  : { type: "spring", stiffness: 320, damping: 22, duration: 0.45 }
              }
              aria-hidden="true"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/animation/coin-bg.svg?v=${renderKey}`}
                alt=""
                width={380}
                height={380}
                className="size-80 sm:size-96 max-w-none object-contain pointer-events-none"
                draggable={false}
              />
            </motion.div>
          ) : null}
        </AnimatePresence>

        {/* Step 3: coin.json 3D rotating Lottie coin (fixed size container so it NEVER shifts) */}
        <div className="relative size-44 sm:size-56 flex items-center justify-center pointer-events-none">
          {showCoin ? (
            <motion.div
              className="size-full flex items-center justify-center pointer-events-none"
              initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0, y: 24 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={
                reduceMotion
                  ? { duration: 0 }
                  : {
                      type: "spring",
                      stiffness: 440,
                      damping: 18,
                      mass: 0.9,
                    }
              }
              aria-hidden="true"
            >
              {/* Centered blooming halo right behind the coin */}
              <motion.div
                className="absolute size-44 sm:size-56 rounded-full blur-2xl pointer-events-none"
                initial={{ opacity: 0, scale: 0.6 }}
                animate={{ opacity: 0.65, scale: 1 }}
                transition={{ duration: 0.6, ease: "easeOut" }}
                style={{
                  background:
                    "radial-gradient(circle, rgba(255, 220, 0, 0.75) 0%, rgba(255, 180, 0, 0.25) 55%, transparent 80%)",
                }}
              />

              {/* Lottie 3D Coin Rotation with Sparkles */}
              <div className="size-44 sm:size-56 flex items-center justify-center drop-shadow-[0_12px_36px_rgba(255,199,0,0.55)]">
                <DotLottieReact
                  src="/animation/coin.json"
                  autoplay
                  loop
                  className="size-full object-contain pointer-events-none"
                  renderConfig={{ autoResize: true, devicePixelRatio: 2 }}
                />
              </div>
            </motion.div>
          ) : null}
        </div>

        {/* Step 4: Text placed directly below the coin with absolute positioning to prevent ANY layout shift */}
        <div className="absolute top-[calc(100%+14px)] left-1/2 -translate-x-1/2 w-max max-w-[90vw] flex flex-col items-center pointer-events-none">
          <AnimatePresence>
            {showText ? (
              <motion.div
                key="celebration-text-content"
                className="relative flex flex-col items-center text-center select-none"
                initial={
                  reduceMotion
                    ? { opacity: 0 }
                    : { opacity: 0, y: 24, scale: 0.8 }
                }
                animate={{
                  opacity: 1,
                  y: 0,
                  scale: 1,
                }}
                exit={{ opacity: 0, y: 12, scale: 0.9 }}
                transition={
                  reduceMotion
                    ? { duration: 0 }
                    : {
                        type: "spring",
                        stiffness: 380,
                        damping: 20,
                        mass: 0.85,
                      }
                }
              >
                {/* Soft ambient golden glow behind the text */}
                <motion.div
                  className="absolute -inset-4 rounded-full blur-xl pointer-events-none"
                  initial={{ opacity: 0, scale: 0.7 }}
                  animate={{ opacity: 0.5, scale: 1 }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
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

                  {/* Sparkle star popping out on the top-right of the number */}
                  {!reduceMotion ? (
                    <motion.div
                      initial={{ opacity: 0, scale: 0, rotate: -45 }}
                      animate={{ opacity: 1, scale: 1, rotate: 0 }}
                      transition={{ delay: 0.15, type: "spring", stiffness: 450, damping: 14 }}
                      className="absolute -top-3 -right-6 text-[#FFE57F] pointer-events-none"
                    >
                      <Sparkles className="size-5 sm:size-6 drop-shadow-[0_0_12px_rgba(255,220,0,0.8)]" />
                    </motion.div>
                  ) : null}
                </div>

                {/* Subtitle text - clean typography without chip */}
                <motion.div
                  initial={
                    reduceMotion
                      ? { opacity: 0 }
                      : { opacity: 0, y: 12 }
                  }
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.16, duration: 0.35, ease: "easeOut" }}
                  className="mt-2.5 flex flex-col items-center gap-1 text-center max-w-[340px]"
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
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );

  return createPortal(
    <AnimatePresence>{content}</AnimatePresence>,
    document.body,
  );
}
