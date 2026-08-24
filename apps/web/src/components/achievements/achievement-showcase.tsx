"use client";

import { useCallback, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { AnimatePresence } from "framer-motion";
import type { AchievementShowcaseView, AchievementView } from "@mentor/types";

import { Link } from "@/i18n/navigation";
import { AchievementArt } from "./achievement-art";
import { AchievementDetail } from "./achievement-detail";

interface AchievementShowcaseProps {
  showcase: AchievementShowcaseView | null;
  username: string;
  enabled: boolean;
}

export function AchievementShowcase({
  showcase,
  username,
  enabled,
}: AchievementShowcaseProps) {
  const t = useTranslations("achievements");
  const locale = useLocale();
  const [selected, setSelected] = useState<AchievementView | null>(null);
  const selectedTriggerRef = useRef<HTMLButtonElement | null>(null);

  const handleOpen = useCallback(
    (achievement: AchievementView, trigger: HTMLButtonElement) => {
      selectedTriggerRef.current = trigger;
      setSelected(achievement);
    },
    [],
  );
  const handleClose = useCallback(() => {
    setSelected(null);
  }, []);
  const handleExitComplete = useCallback(() => {
    window.requestAnimationFrame(() => selectedTriggerRef.current?.focus());
  }, []);

  if (!enabled || !showcase || showcase.items.length === 0) return null;

  return (
    <section
      aria-labelledby="achievement-showcase-title"
      className="border-t border-[var(--color-border)] px-4 py-5 sm:px-5"
    >
      <div className="mx-auto max-w-[65ch] xl:mx-0 xl:pl-3">
        <div className="flex items-center justify-between gap-4">
          <h2
            id="achievement-showcase-title"
            className="text-sm font-bold text-[var(--color-main)]"
          >
            {t("showcase_title")}
          </h2>
          {showcase.earnedCount > 3 ? (
            <Link
              href={{
                pathname: "/community/member/[username]",
                params: { username },
                query: { tab: "achievements" },
              }}
              className="inline-flex min-h-11 shrink-0 items-center text-sm font-semibold text-[var(--color-accent)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
            >
              {t("showcase_view_all")}
            </Link>
          ) : null}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap justify-center gap-3">
        {showcase.items.map((achievement) => (
          <button
            key={achievement.id}
            type="button"
            aria-label={t("showcase_earned_aria", {
              title: achievement.title,
            })}
            onClick={(event) => handleOpen(achievement, event.currentTarget)}
            className="grid size-16 place-items-center rounded-[var(--radius-card)] p-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
          >
            <AchievementArt
              artKey={achievement.artKey}
              alt=""
              className="size-full object-contain"
            />
          </button>
        ))}
      </div>
      <AnimatePresence onExitComplete={handleExitComplete}>
        {selected ? (
          <AchievementDetail
            key={selected.id}
            achievement={selected}
            locale={locale}
            onClose={handleClose}
          />
        ) : null}
      </AnimatePresence>
    </section>
  );
}
