"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useTranslations } from "next-intl";
import {
  chatBubbleAnimate,
  chatBubbleInitial,
  chatBubbleTransition,
} from "@/lib/stagger-motion";

const chipBase =
  "inline-flex h-9 max-w-full shrink-0 cursor-pointer items-center rounded-full bg-[var(--color-surface)] px-3.5 text-[12px] font-semibold whitespace-nowrap shadow-[var(--shadow-card)] transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 motion-reduce:transition-none";

/**
 * Ephemeral follow-up seeds for the latest coach reply — docked above the composer
 * (same scale as empty-landing starter chips).
 */
export function CoachFollowUpChips({
  questions,
  onSeed,
}: {
  questions: string[];
  onSeed: (text: string) => void;
}) {
  const translate = useTranslations("coach_chat");
  const reduceMotion = useReducedMotion();
  if (questions.length === 0) return null;

  return (
    <motion.div
      className="mx-auto flex w-full max-w-md flex-wrap justify-center gap-2"
      role="group"
      aria-label={translate("followups_label")}
      data-testid="coach-follow-up-chips"
      initial={reduceMotion ? false : chatBubbleInitial}
      animate={chatBubbleAnimate}
      transition={
        reduceMotion
          ? { duration: 0 }
          : { ...chatBubbleTransition, duration: 0.32 }
      }
    >
      {questions.map((question) => (
        <button
          key={question}
          type="button"
          onClick={() => onSeed(question)}
          className={chipBase}
          style={{ color: "var(--color-main)" }}
        >
          {question}
        </button>
      ))}
    </motion.div>
  );
}
