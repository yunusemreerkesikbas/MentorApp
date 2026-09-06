"use client";

import { ArrowRight, Compass } from "lucide-react";
import { motion } from "framer-motion";
import type { QuestProgressView } from "@mentor/types";

interface QuestNextActionCardProps {
  nextQuest: QuestProgressView;
  nextStepLabel: string;
  onAction: (action: QuestProgressView["action"]) => Promise<void>;
  reduceMotion: boolean;
}

/**
 * High-priority next action card (inspired by Reference 2's action pill and Reference 3's clean card layout).
 */
export function QuestNextActionCard({
  nextQuest,
  nextStepLabel,
  onAction,
  reduceMotion,
}: QuestNextActionCardProps) {
  return (
    <motion.button
      type="button"
      className="group mt-3 flex w-full cursor-pointer items-center justify-between gap-3 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 py-3 text-left shadow-[var(--shadow-card)] transition-all duration-200 hover:border-[color-mix(in_srgb,var(--color-main)_28%,transparent)] hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus)]"
      onClick={() => void onAction(nextQuest.action)}
      whileTap={reduceMotion ? undefined : { scale: 0.985 }}
    >
      <div className="flex min-w-0 items-center gap-3">
        <div className="grid size-8 shrink-0 place-items-center rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400">
          <Compass className="size-4.5 stroke-[2.2]" aria-hidden />
        </div>
        <div className="min-w-0">
          <span className="block text-[11px] font-bold uppercase tracking-wider text-[var(--color-secondary)]">
            {nextStepLabel}
          </span>
          <span className="mt-0.5 block truncate text-sm font-bold text-[var(--color-main)] sm:text-base">
            {nextQuest.title}
          </span>
        </div>
      </div>
      <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--color-main)_6%,transparent)] text-[var(--color-main)] transition-transform duration-200 group-hover:translate-x-0.5">
        <ArrowRight className="size-4" aria-hidden />
      </div>
    </motion.button>
  );
}
