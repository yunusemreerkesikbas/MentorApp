"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useTranslations } from "next-intl";
import type { AchievementCelebrationDto } from "@mentor/types";
import { Button } from "@mentor/ui";
import { AchievementArt } from "./achievement-art";

export function AchievementCelebration({
  celebration,
  busy,
  onClose,
}: {
  celebration: AchievementCelebrationDto;
  busy: boolean;
  onClose: () => void;
}) {
  const t = useTranslations("achievements");
  const reducedMotion = useReducedMotion();
  const item = celebration.items[0];
  if (!item) return null;
  const isBackfill = celebration.kind === "BACKFILL_SUMMARY";

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm">
      <motion.section
        role="dialog"
        aria-modal="true"
        aria-labelledby="achievement-celebration-title"
        initial={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.86, rotate: -3 }}
        animate={{ opacity: 1, scale: 1, rotate: 0 }}
        transition={{ duration: reducedMotion ? 0.15 : 0.42, ease: "easeOut" }}
        className="w-full max-w-md overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-6 text-center shadow-[var(--shadow-card)]"
      >
        <motion.div
          animate={reducedMotion ? undefined : { y: [0, -7, 0] }}
          transition={{ repeat: Infinity, duration: 2.4, ease: "easeInOut" }}
        >
          <AchievementArt artKey={item.artKey} alt="" priority className="mx-auto size-64 max-w-full object-contain" />
        </motion.div>
        <p className="text-xs font-bold uppercase tracking-widest text-[var(--color-accent)]">
          {isBackfill ? t("history_eyebrow") : t("celebration_eyebrow")}
        </p>
        <h2 id="achievement-celebration-title" className="mt-2 text-2xl font-extrabold text-[var(--color-main)]">
          {isBackfill ? t("history_title") : item.title}
        </h2>
        <p className="mt-2 text-sm leading-6 text-[var(--color-secondary)]">
          {isBackfill ? t("history_body", { count: celebration.items.length }) : item.description}
        </p>
        <Button className="mt-6 w-full" busy={busy} onClick={onClose}>{t("continue")}</Button>
      </motion.section>
    </div>
  );
}
