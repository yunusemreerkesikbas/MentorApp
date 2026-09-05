"use client";

import { ArrowRight, CheckCircle2, Coins, Gem, LoaderCircle } from "lucide-react";
import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import type { QuestProgressView } from "@mentor/types";

interface QuestRowItemProps {
  busy: boolean;
  onAction: (action: QuestProgressView["action"]) => Promise<void>;
  quest: QuestProgressView;
  reduceMotion: boolean;
}

/**
 * Task item row (inspired by Reference 3: clean to-do item cards, status ring/check,
 * strikethrough completed title, and distinct XP/Coin/Done pill badges).
 */
export function QuestRowItem({
  busy,
  onAction,
  quest,
  reduceMotion,
}: QuestRowItemProps) {
  const translate = useTranslations("economy");
  const action = quest.completed ? null : quest.action;
  const progressCurrent = quest.progressCurrent;
  const progressTarget = quest.progressTarget;
  const hasProgress = progressCurrent !== undefined && progressTarget !== undefined;
  const progressPercent =
    hasProgress && progressTarget > 0
      ? Math.min(100, Math.max(0, (progressCurrent / progressTarget) * 100))
      : 0;

  const content = (
    <>
      {/* Left indicator ring / checkmark (Image 3 style) */}
      <span className="grid size-6 shrink-0 place-items-center">
        {quest.completed ? (
          <CheckCircle2
            className="size-5.5 text-[var(--color-success)] stroke-[2.3]"
            aria-hidden
          />
        ) : (
          <span
            className="size-5 rounded-full border-2 border-[var(--color-secondary)]/35 transition-colors group-hover:border-[var(--color-main)]"
            aria-hidden
          />
        )}
      </span>

      {/* Middle: Title, Badge, and Progress */}
      <span className="min-w-0 flex-1 text-left">
        <span
          className={`block truncate text-sm font-semibold sm:text-base ${
            quest.completed
              ? "line-through text-[var(--color-secondary)] opacity-70"
              : "text-[var(--color-main)]"
          }`}
        >
          {quest.title}
        </span>

        <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs font-semibold text-[var(--color-secondary)]">
          <span>{quest.badgeLabel}</span>
          {hasProgress ? (
            <span className="tabular-nums">
              ·{" "}
              {translate(
                quest.id.startsWith("milestone.streak.") || quest.id === "weekly.streak-full-week"
                  ? "quest_progress_days"
                  : "quest_progress_count",
                {
                  current: progressCurrent,
                  target: progressTarget,
                },
              )}
            </span>
          ) : null}
        </span>

        {hasProgress ? (
          <span
            aria-hidden="true"
            className="mt-2 block h-1.5 max-w-[220px] overflow-hidden rounded-full bg-[var(--color-progress-track)]"
          >
            <span
              className="block h-full rounded-full bg-[var(--color-progress)] transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </span>
        ) : null}
      </span>

      {/* Right: Clean typography rewards and completed badge */}
      {quest.completed ? (
        <span className="inline-flex shrink-0 items-center rounded-full bg-[color-mix(in_srgb,var(--color-success)_14%,transparent)] px-2.5 py-1 text-xs font-bold text-[var(--color-success)]">
          {translate("quest_completed")}
        </span>
      ) : quest.rewardUnit === "XP" ? (
        <span className="inline-flex shrink-0 items-center gap-1 text-xs font-bold text-[var(--color-chip-text)] dark:text-violet-300 sm:text-sm">
          <Gem className="size-3.5 stroke-[2.2]" aria-hidden />
          <span>{translate("quest_reward_xp", { count: quest.rewardAmount })}</span>
        </span>
      ) : quest.rewardUnit === "COIN" ? (
        <span className="inline-flex shrink-0 items-center gap-1 text-xs font-bold text-amber-500 dark:text-amber-400 sm:text-sm">
          <Coins className="size-3.5 stroke-[2.2]" aria-hidden />
          <span>{translate("quest_reward_coin", { count: quest.rewardAmount })}</span>
        </span>
      ) : null}

      {/* Action Chevron or Spinner */}
      {action ? (
        busy ? (
          <LoaderCircle
            className="size-4 shrink-0 animate-spin text-[var(--color-main)] motion-reduce:animate-none"
            aria-hidden
          />
        ) : (
          <div className="grid size-6 shrink-0 place-items-center text-[var(--color-secondary)] transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-[var(--color-main)]">
            <ArrowRight className="size-4" aria-hidden />
          </div>
        )
      ) : null}
    </>
  );

  return (
    <motion.li
      data-testid="daily-quest-row"
      className={`group relative overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-3 transition-all duration-200 shadow-sm hover:border-[color-mix(in_srgb,var(--color-main)_22%,transparent)] hover:shadow-md ${
        quest.completed ? "opacity-60 bg-[color-mix(in_srgb,var(--color-surface)_65%,transparent)]" : ""
      }`}
      whileHover={reduceMotion || !action ? undefined : { y: -1 }}
      whileTap={reduceMotion || !action ? undefined : { scale: 0.99 }}
    >
      {action ? (
        <button
          type="button"
          className="flex min-h-10 w-full min-w-0 cursor-pointer items-center gap-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus)] disabled:cursor-wait disabled:opacity-70"
          disabled={busy}
          onClick={() => void onAction(action)}
        >
          {content}
        </button>
      ) : (
        <div className="flex min-h-10 min-w-0 items-center gap-3">{content}</div>
      )}
    </motion.li>
  );
}
