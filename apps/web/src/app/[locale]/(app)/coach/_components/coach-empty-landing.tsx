"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { motion, useReducedMotion } from "framer-motion";
import { PuhuImage } from "@/components/puhu-image";
import { useAuth } from "@/lib/auth-context";

function greetingKeyForHour():
  | "greeting_morning"
  | "greeting_day"
  | "greeting_evening" {
  const hour = new Date().getHours();
  if (hour < 12) return "greeting_morning";
  if (hour < 18) return "greeting_day";
  return "greeting_evening";
}

function firstName(displayName: string): string {
  const part = displayName.trim().split(/\s+/)[0];
  return part || displayName;
}

const lineClass =
  "w-full truncate text-[22px] leading-[1.2] tracking-tight sm:text-[24px]";

const richBold = {
  bold: (chunks: ReactNode) => (
    <span className="font-bold">{chunks}</span>
  ),
};

/**
 * New-chat empty state: greeting + help + Puhu only.
 * Pastel backdrop lives on CoachChatShell (full main). Chips sit above the composer.
 */
export function CoachEmptyLanding() {
  const t = useTranslations("coach.landing");
  const { user } = useAuth();
  const reduceMotion = useReducedMotion();

  const name = user?.displayName
    ? firstName(user.displayName)
    : t("greeting_fallback");

  return (
    <motion.div
      className="flex min-h-0 flex-1 flex-col items-center overflow-hidden pt-1"
      initial={reduceMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: "easeOut" }}
      data-testid="coach-empty-landing"
    >
      <div
        className="flex w-full max-w-lg shrink-0 flex-col items-center px-1 text-center font-medium"
        style={{
          color: "var(--color-main)",
          fontFamily: "var(--font-heading)",
        }}
      >
        <p className={lineClass}>
          {t.rich(greetingKeyForHour(), {
            name,
            ...richBold,
          })}
        </p>
        <h2 className={`mt-1 ${lineClass}`}>
          {t.rich("help_text", richBold)}
        </h2>
      </div>

      <div className="relative flex min-h-0 w-full flex-1 items-center justify-center py-2">
        <PuhuImage
          variant="encouraging"
          size={120}
          priority
          className="max-h-full w-auto drop-shadow-[var(--shadow-card)]"
        />
      </div>
    </motion.div>
  );
}
