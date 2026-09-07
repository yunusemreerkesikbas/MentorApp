"use client";

import { motion } from "framer-motion";
import { CheckCircle2, ChevronDown, Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import { CoinCelebrationVisual } from "./coin-celebration-visual";

export interface CoinCelebrationCardProps {
  badgeLabel?: string;
  title?: string;
  subtitle?: string;
  completedCount?: number;
  totalCount?: number;
  showTasksToggle?: boolean;
  tasksVisible?: boolean;
  onToggleTasks?: () => void;
  reduceMotion?: boolean;
}

/**
 * Embedded celebratory card for completed ritual / quest states.
 * Replaces or crowns empty completed states with a high-triumph 3D coin illustration.
 */
export function CoinCelebrationCard({
  badgeLabel,
  title,
  subtitle,
  completedCount,
  totalCount,
  showTasksToggle = false,
  tasksVisible = false,
  onToggleTasks,
  reduceMotion = false,
}: CoinCelebrationCardProps) {
  const t = useTranslations("economy");

  const resolvedBadge = badgeLabel ?? t("quests_daily_state", { defaultValue: "Günün Ritüeli" });
  const resolvedTitle = title ?? t("quests_completed_hero_title", { defaultValue: "Tüm Görevler Tamamlandı!" });
  const resolvedSubtitle = subtitle ?? t("quests_completed_hero_subtitle", {
    defaultValue: "Bugünkü tüm adımlarını eksiksiz bitirdin. Emeklerine sağlık, harika gidiyorsun!",
  });

  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, y: 10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={
        reduceMotion
          ? { duration: 0 }
          : { type: "spring", stiffness: 360, damping: 24 }
      }
      className="relative overflow-hidden rounded-[var(--radius-card)] border border-amber-500/25 bg-[color-mix(in_srgb,var(--color-surface)_90%,#1c160c)] p-5 text-center shadow-[var(--shadow-card)] dark:border-amber-400/20 dark:bg-[#12101e]"
    >
      {/* Ambient background golden gradient glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          background:
            "radial-gradient(circle at 50% 15%, rgba(255, 199, 0, 0.28) 0%, rgba(251, 146, 60, 0.12) 40%, transparent 75%)",
        }}
      />

      <div className="relative z-10 flex flex-col items-center">
        {/* Top Status Pill */}
        <div className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/35 bg-amber-400/15 px-3 py-1 text-xs font-bold text-amber-600 dark:text-amber-300 shadow-sm backdrop-blur-sm">
          <Sparkles className="size-3.5 text-amber-500 dark:text-amber-300" aria-hidden />
          <span>{resolvedBadge}</span>
        </div>

        {/* 3D Lottie Coin Visual */}
        <div className="my-2.5 flex items-center justify-center">
          <CoinCelebrationVisual
            size="md"
            showBurst={false}
            showCoin={true}
            showGlow={true}
            reduceMotion={reduceMotion}
          />
        </div>

        {/* Title & Subtitle */}
        <h3
          className="text-lg sm:text-xl font-bold tracking-tight text-[var(--color-main)]"
          style={{ fontFamily: "var(--font-heading)" }}
        >
          {resolvedTitle}
        </h3>

        <p className="mt-1.5 max-w-[320px] text-xs sm:text-sm font-medium leading-relaxed text-[var(--color-secondary)] text-balance">
          {resolvedSubtitle}
        </p>

        {/* Progress Metric Chip */}
        {completedCount !== undefined && totalCount !== undefined && totalCount > 0 ? (
          <div className="mt-3.5 inline-flex items-center gap-1.5 rounded-full bg-[color-mix(in_srgb,var(--color-success)_14%,transparent)] px-3 py-1 text-xs font-bold text-[var(--color-success)]">
            <CheckCircle2 className="size-3.5 stroke-[2.5]" aria-hidden />
            <span>
              {t("quests_progress", {
                done: completedCount,
                total: totalCount,
                defaultValue: `${completedCount}/${totalCount} görev tamamlandı`,
              })}
            </span>
          </div>
        ) : null}

        {/* Optional Toggle to inspect completed tasks */}
        {showTasksToggle && onToggleTasks ? (
          <button
            type="button"
            onClick={onToggleTasks}
            className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--color-secondary)] hover:text-[var(--color-main)] transition-colors cursor-pointer py-1 px-2.5 rounded-md hover:bg-black/5 dark:hover:bg-white/5"
            aria-expanded={tasksVisible}
          >
            <span>
              {tasksVisible
                ? t("quests_completed_hide_tasks", { defaultValue: "Tamamlanan görevleri gizle" })
                : t("quests_completed_view_tasks", { defaultValue: "Tamamlanan görevleri göster" })}
            </span>
            <ChevronDown
              className={`size-3.5 transition-transform duration-200 ${
                tasksVisible ? "rotate-180" : ""
              }`}
              aria-hidden
            />
          </button>
        ) : null}
      </div>
    </motion.div>
  );
}
