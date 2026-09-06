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

/**
 * Atmospheric celebratory progress gauge (Reference 1 & 2 style):
 * Deep twilight sky with radiant sunset aura, cloud silhouettes, luminous cyan-indigo arc,
 * and high-contrast crisp metrics. Acts as a jewel-like hero illustration card in both light and dark themes.
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

  return (
    <div className="relative overflow-hidden rounded-[var(--radius-card)] border border-slate-900/10 bg-[#0d0c22] px-4 pt-5 pb-3.5 shadow-[var(--shadow-card)] [--gauge-end:#818cf8] [--gauge-start:#38bdf8] dark:border-white/10 dark:bg-[#0c0a1d]">
      {/* Deep twilight sky background with radiant sunset heart (Reference 1 & 2) */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(130% 120% at 50% 10%, rgba(251, 146, 60, 0.32) 0%, rgba(236, 72, 153, 0.20) 35%, rgba(30, 27, 75, 0.85) 75%, #0d0c22 100%)",
        }}
      />

      {/* Radiant warm sunset glow directly behind arc */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-2 left-1/2 h-[170px] w-[270px] -translate-x-1/2 rounded-full blur-2xl opacity-90"
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(251, 146, 60, 0.55) 0%, rgba(244, 63, 94, 0.32) 45%, rgba(147, 51, 234, 0.18) 75%, transparent 90%)",
        }}
      />

      {/* Atmospheric sunset cloud silhouettes at bottom (Reference 1 style) */}
      <svg
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-16 w-full opacity-40 mix-blend-screen"
        preserveAspectRatio="none"
        viewBox="0 0 400 70"
      >
        <defs>
          <linearGradient id="cloudGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.8" />
            <stop offset="45%" stopColor="#ec4899" stopOpacity="0.45" />
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
          opacity="0.28"
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
              <stop offset="0%" stopColor="var(--gauge-start)" />
              <stop offset="100%" stopColor="var(--gauge-end)" />
            </linearGradient>
          </defs>

          {/* Clean background track */}
          <path
            d={ARC_PATH}
            fill="none"
            stroke="rgba(255, 255, 255, 0.16)"
            strokeLinecap="round"
            strokeWidth={11}
          />

          {/* Animated active progress arc with natural rounded end cap */}
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
        </svg>

        {/* Center Metric & Status Area */}
        <div className="absolute inset-x-0 bottom-1 flex flex-col items-center text-center">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/30 bg-amber-400/15 px-2.5 py-0.5 text-[11px] font-bold tracking-wide text-amber-200 shadow-sm backdrop-blur-sm">
            <Sparkles className="size-3 text-amber-300" aria-hidden />
            <span>{stateLabel}</span>
          </div>

          <span className="mt-1 text-4xl font-extrabold tracking-tight text-white tabular-nums drop-shadow-sm sm:text-5xl">
            {percentLabel}
          </span>

          {isAllDone ? (
            <motion.span
              animate={{ scale: 1, opacity: 1 }}
              className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-emerald-400/35 bg-emerald-500/20 px-3 py-0.5 text-xs font-bold text-emerald-200 shadow-sm backdrop-blur-sm"
              initial={{ scale: reduceMotion ? 1 : 0.9, opacity: reduceMotion ? 1 : 0 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
            >
              <CheckCircle2 className="size-3.5 stroke-[2.5]" aria-hidden />
              {allDoneLabel ?? progressLabel}
            </motion.span>
          ) : (
            <span className="mt-1 text-xs font-semibold text-white/85 tabular-nums sm:text-sm">
              {progressLabel}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
