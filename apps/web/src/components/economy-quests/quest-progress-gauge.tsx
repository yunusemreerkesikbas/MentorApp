"use client";

import { CheckCircle2, Sparkles } from "lucide-react";
import { motion } from "framer-motion";

interface QuestProgressGaugeProps {
  allDoneLabel?: string;
  completed: number;
  percent: number;
  percentLabel: string;
  progressLabel: string;
  reduceMotion: boolean;
  stateLabel: string;
  total: number;
}

const ARC_PATH = "M 28 128 A 112 112 0 0 1 252 128";
const ARC_CENTER_X = 140;
const ARC_CENTER_Y = 128;
const ARC_RADIUS = 112;

/**
 * Atmospheric progress gauge with vivid ambient sunset aura (Reference 1 & 2 style),
 * clean arc linecaps (no awkward endpoint dots), and celebratory badge.
 */
export function QuestProgressGauge({
  allDoneLabel,
  completed,
  percent,
  percentLabel,
  progressLabel,
  reduceMotion,
  stateLabel,
  total,
}: QuestProgressGaugeProps) {
  const progress = Math.min(100, Math.max(0, percent)) / 100;
  const isAllDone = total > 0 && completed >= total;

  // Calculate coordinates of current progress along the arc (from 180° on left to 0° on right)
  const angleRad = Math.PI * (1 - progress);
  const pinX = ARC_CENTER_X + ARC_RADIUS * Math.cos(angleRad);
  const pinY = ARC_CENTER_Y - ARC_RADIUS * Math.sin(angleRad);

  return (
    <div
      className="relative overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-border)] px-4 pt-5 pb-3.5 shadow-[var(--shadow-card)]"
      style={{
        // Prominent atmospheric background: deep twilight sky with warm radiant heart (Reference 1 & 2)
        background:
          "radial-gradient(130% 120% at 50% 10%, rgba(251, 146, 60, 0.28) 0%, rgba(236, 72, 153, 0.16) 35%, rgba(30, 27, 75, 0.75) 75%, var(--color-surface) 100%)",
      }}
    >
      {/* Radiant warm sunset glow directly behind the arc (Reference 2 style) */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-2 left-1/2 h-[170px] w-[270px] -translate-x-1/2 rounded-full blur-2xl opacity-90"
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(251, 146, 60, 0.50) 0%, rgba(244, 63, 94, 0.30) 45%, rgba(147, 51, 234, 0.15) 75%, transparent 90%)",
        }}
      />

      {/* Atmospheric sunset cloud silhouettes at the bottom (Reference 1 style) */}
      <svg
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-16 w-full opacity-35 mix-blend-screen"
        preserveAspectRatio="none"
        viewBox="0 0 400 70"
      >
        <defs>
          <linearGradient id="cloudGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.75" />
            <stop offset="45%" stopColor="#ec4899" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#1e1b4b" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path
          d="M0 48 Q 50 25 110 36 Q 170 12 240 30 Q 310 8 360 28 Q 385 18 400 38 L 400 70 L 0 70 Z"
          fill="url(#cloudGrad)"
        />
        <path
          d="M0 56 Q 70 40 150 46 Q 230 28 310 42 Q 365 32 400 50 L 400 70 L 0 70 Z"
          fill="#fb923c"
          opacity="0.25"
        />
      </svg>

      <div className="relative mx-auto h-[142px] w-full max-w-[340px]">
        <svg
          aria-label={`${progressLabel} ${percentLabel}`}
          className="h-full w-full overflow-visible"
          role="img"
          viewBox="0 8 280 136"
        >
          <defs>
            <linearGradient id="gaugeProgressGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#38bdf8" />
              <stop offset="100%" stopColor="#60a5fa" />
            </linearGradient>
            <filter id="pinGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="#38bdf8" floodOpacity="0.75" />
            </filter>
          </defs>

          {/* Clean background track (no clumsy dots at endpoints) */}
          <path
            d={ARC_PATH}
            fill="none"
            stroke="color-mix(in srgb, var(--color-main) 16%, transparent)"
            strokeLinecap="round"
            strokeWidth={11}
          />

          {/* Animated active progress arc — only drawn when progress > 0 so 0% has no artifact blob */}
          {progress > 0 ? (
            <motion.path
              animate={{ pathLength: progress }}
              d={ARC_PATH}
              fill="none"
              initial={{ pathLength: reduceMotion ? progress : 0 }}
              pathLength={1}
              stroke="url(#gaugeProgressGrad)"
              strokeLinecap="round"
              strokeWidth={11}
              transition={
                reduceMotion
                  ? { duration: 0 }
                  : { duration: 0.85, ease: [0.22, 1, 0.36, 1] }
              }
            />
          ) : null}

          {/* Gliding Tip Light Core — sleek white flare matching stroke, no yellow yolk */}
          {progress > 0 && progress < 1 ? (
            <motion.g
              animate={{ cx: pinX, cy: pinY }}
              initial={false}
              transition={
                reduceMotion
                  ? { duration: 0 }
                  : { duration: 0.85, ease: [0.22, 1, 0.36, 1] }
              }
            >
              {/* Soft light aura */}
              <circle
                cx={pinX}
                cy={pinY}
                filter="url(#pinGlow)"
                r={7}
                fill="#38bdf8"
                opacity={0.4}
              />
              {/* Crisp white light core */}
              <circle
                cx={pinX}
                cy={pinY}
                r={3.5}
                fill="#ffffff"
              />
            </motion.g>
          ) : null}
        </svg>

        {/* Center Metric & Status Area */}
        <div className="absolute inset-x-0 bottom-1 flex flex-col items-center text-center">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/25 bg-amber-400/10 px-2.5 py-0.5 text-[11px] font-bold tracking-wide text-amber-200 backdrop-blur-sm shadow-sm">
            <Sparkles className="size-3 text-amber-300" aria-hidden />
            <span>{stateLabel}</span>
          </div>

          <span className="mt-1 text-4xl font-extrabold tracking-tight text-white tabular-nums drop-shadow-sm sm:text-5xl">
            {percentLabel}
          </span>

          {isAllDone ? (
            <motion.span
              animate={{ scale: 1, opacity: 1 }}
              className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-emerald-400/30 bg-[color-mix(in_srgb,var(--color-success)_20%,transparent)] px-3 py-0.5 text-xs font-bold text-emerald-300 shadow-sm"
              initial={{ scale: reduceMotion ? 1 : 0.9, opacity: reduceMotion ? 1 : 0 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
            >
              <CheckCircle2 className="size-3.5 stroke-[2.5]" aria-hidden />
              {allDoneLabel ?? progressLabel}
            </motion.span>
          ) : (
            <span className="mt-1 text-xs font-semibold text-white/80 tabular-nums drop-shadow-sm sm:text-sm">
              {progressLabel}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
