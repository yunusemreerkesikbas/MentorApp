"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { DotLottieReact } from "@lottiefiles/dotlottie-react";

export interface CoinCelebrationVisualProps {
  size?: "sm" | "md" | "lg";
  showBurst?: boolean;
  showCoin?: boolean;
  showGlow?: boolean;
  reduceMotion?: boolean;
  className?: string;
}

const SIZE_MAP = {
  sm: {
    container: "size-24 sm:size-28",
    burst: "size-48 sm:size-56",
    glow: "size-40 sm:size-48",
    halo: "size-24 sm:size-28",
    shadow: "drop-shadow-[0_8px_20px_rgba(255,199,0,0.45)]",
  },
  md: {
    container: "size-32 sm:size-40",
    burst: "size-64 sm:size-72",
    glow: "size-56 sm:size-64",
    halo: "size-32 sm:size-40",
    shadow: "drop-shadow-[0_10px_28px_rgba(255,199,0,0.5)]",
  },
  lg: {
    container: "size-44 sm:size-56",
    burst: "size-80 sm:size-96",
    glow: "size-72 sm:size-88",
    halo: "size-44 sm:size-56",
    shadow: "drop-shadow-[0_12px_36px_rgba(255,199,0,0.55)]",
  },
} as const;

/**
 * Reusable 3D Lottie coin + particle burst visual presentation.
 * Shared between CoinCelebration modal and CoinCelebrationCard inline views.
 */
export function CoinCelebrationVisual({
  size = "lg",
  showBurst = true,
  showCoin = true,
  showGlow = true,
  reduceMotion = false,
  className = "",
}: CoinCelebrationVisualProps) {
  const [renderKey] = useState(() => Date.now());
  const dimensions = SIZE_MAP[size];

  return (
    <div className={`relative flex items-center justify-center select-none pointer-events-none ${className}`}>
      {/* Soft golden ambient radial glow behind everything */}
      {showGlow ? (
        <motion.div
          className={`absolute rounded-full blur-3xl opacity-45 pointer-events-none ${dimensions.glow}`}
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
        {showBurst ? (
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
              className={`${dimensions.burst} max-w-none object-contain pointer-events-none`}
              draggable={false}
            />
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* Step 3: coin.json 3D rotating Lottie coin (fixed size container so it never shifts) */}
      <div className={`relative flex items-center justify-center pointer-events-none ${dimensions.container}`}>
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
              className={`absolute rounded-full blur-2xl pointer-events-none ${dimensions.halo}`}
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 0.65, scale: 1 }}
              transition={{ duration: 0.6, ease: "easeOut" }}
              style={{
                background:
                  "radial-gradient(circle, rgba(255, 220, 0, 0.75) 0%, rgba(255, 180, 0, 0.25) 55%, transparent 80%)",
              }}
            />

            {/* Lottie 3D Coin Rotation with Sparkles */}
            <div className={`size-full flex items-center justify-center relative ${dimensions.shadow}`}>
              {/* Immediate SVG presentation ensures zero blank-frame latency */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/animation/coin.svg"
                alt=""
                width={240}
                height={240}
                className="absolute inset-0 size-full object-contain pointer-events-none"
                draggable={false}
              />
              <DotLottieReact
                src="/animation/coin.json"
                autoplay
                loop
                className="size-full object-contain pointer-events-none relative z-10"
                renderConfig={{ autoResize: true, devicePixelRatio: 2 }}
              />
            </div>
          </motion.div>
        ) : null}
      </div>
    </div>
  );
}
