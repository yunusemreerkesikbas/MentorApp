"use client";

import { useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Info, Lock } from "lucide-react";
import { AnimatePresence } from "framer-motion";
import type { AchievementCollectionDto, AchievementView } from "@mentor/types";
import { AchievementArt } from "./achievement-art";
import { AchievementDetail } from "./achievement-detail";

export function AchievementCollection({
  collection,
}: {
  collection: AchievementCollectionDto;
}) {
  const t = useTranslations("achievements");
  const locale = useLocale();
  const [selected, setSelected] = useState<AchievementView | null>(null);
  const selectedTriggerRef = useRef<HTMLButtonElement | null>(null);

  const handleOpen = (
    achievement: AchievementView,
    trigger: HTMLButtonElement,
  ) => {
    selectedTriggerRef.current = trigger;
    setSelected(achievement);
  };

  const handleClose = () => {
    setSelected(null);
  };

  const handleExitComplete = () => {
    window.requestAnimationFrame(() => selectedTriggerRef.current?.focus());
  };

  if (collection.items.length === 0) {
    return (
      <p className="px-4 py-12 text-center text-sm text-[var(--color-secondary)]">
        {t("public_empty")}
      </p>
    );
  }

  return (
    <>
      {collection.ownerView && collection.summary ? (
        <AchievementCollectionGuide
          collection={collection}
          onOpen={handleOpen}
        />
      ) : null}
      <div className="grid grid-cols-2 gap-3 px-4 py-6 sm:grid-cols-3 lg:px-6">
        {collection.items.map((achievement) => {
          const earned = achievement.status === "EARNED";
          return (
            <button
              key={achievement.id}
              type="button"
              onClick={(event) => handleOpen(achievement, event.currentTarget)}
              aria-label={
                earned
                  ? achievement.title
                  : t("locked_aria", { title: achievement.title })
              }
              className="group relative rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-left shadow-[var(--shadow-card)] transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
            >
              {!earned && (
                <span
                  data-achievement-info
                  aria-hidden="true"
                  className="absolute right-2 top-2 z-10 grid size-8 place-items-center rounded-full bg-[var(--color-surface)] text-[var(--color-secondary)] shadow-[var(--shadow-card)]"
                >
                  <Info size={16} />
                </span>
              )}
              <div className="relative mx-auto aspect-square w-full max-w-40">
                <AchievementArt
                  artKey={achievement.artKey}
                  alt={earned ? achievement.title : ""}
                  className={`size-full object-contain ${earned ? "" : "grayscale opacity-35"}`}
                />
                {!earned && (
                  <span
                    className="absolute inset-0 flex items-center justify-center"
                    aria-hidden="true"
                  >
                    <span className="rounded-full bg-[var(--color-surface)] p-2 text-[var(--color-secondary)] shadow-[var(--shadow-card)]">
                      <Lock size={18} />
                    </span>
                  </span>
                )}
              </div>
              <p className="mt-2 line-clamp-2 text-center text-sm font-bold text-[var(--color-main)]">
                {achievement.title}
              </p>
              {earned && achievement.earnedAt && (
                <p className="mt-1 text-center text-xs text-[var(--color-secondary)]">
                  {t("earned_on", {
                    date: new Intl.DateTimeFormat(locale).format(
                      new Date(achievement.earnedAt),
                    ),
                  })}
                </p>
              )}
            </button>
          );
        })}
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
    </>
  );
}

function AchievementCollectionGuide({
  collection,
  onOpen,
}: {
  collection: AchievementCollectionDto;
  onOpen: (achievement: AchievementView, trigger: HTMLButtonElement) => void;
}) {
  const t = useTranslations("achievements");
  const summary = collection.summary;

  if (!summary) return null;

  const suggestedAchievement = summary.suggestedAchievementId
    ? collection.items.find(
        (achievement) => achievement.id === summary.suggestedAchievementId,
      )
    : null;
  const completionPercent = Math.round(
    (summary.earnedCount / summary.totalCount) * 100,
  );

  return (
    <section
      aria-labelledby="achievement-collection-guide-title"
      className="mx-4 mt-6 overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-soft)] lg:mx-6"
    >
      <div className="p-4">
        <div className="flex items-center justify-between gap-4">
          <h2
            id="achievement-collection-guide-title"
            className="text-base font-bold text-[var(--color-main)]"
          >
            {t("collection_title")}
          </h2>
          <span className="shrink-0 text-sm font-bold tabular-nums text-[var(--color-main)]">
            {t("collection_count", {
              earned: summary.earnedCount,
              total: summary.totalCount,
            })}
          </span>
        </div>
        <div
          role="progressbar"
          aria-label={t("collection_progress_aria")}
          aria-valuemin={0}
          aria-valuemax={summary.totalCount}
          aria-valuenow={summary.earnedCount}
          aria-valuetext={t("collection_progress_value", {
            earned: summary.earnedCount,
            total: summary.totalCount,
          })}
          className="mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--color-progress-track)]"
        >
          <span
            className="block h-full rounded-full bg-[var(--color-progress)]"
            style={{ width: `${completionPercent}%` }}
          />
        </div>
      </div>

      {suggestedAchievement ? (
        <button
          type="button"
          aria-label={t("suggestion_aria", {
            title: suggestedAchievement.title,
          })}
          onClick={(event) => onOpen(suggestedAchievement, event.currentTarget)}
          className="flex min-h-14 w-full items-center gap-3 border-t border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-focus-ring)]"
        >
          <span className="relative size-16 shrink-0" aria-hidden="true">
            <AchievementArt
              artKey={suggestedAchievement.artKey}
              alt=""
              className="size-full object-contain grayscale opacity-45"
            />
            <span className="absolute inset-0 grid place-items-center">
              <span className="rounded-full bg-[var(--color-surface)] p-1.5 text-[var(--color-secondary)] shadow-[var(--shadow-card)]">
                <Lock size={16} />
              </span>
            </span>
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-xs font-bold uppercase tracking-wide text-[var(--color-accent)]">
              {t("next_discovery")}
            </span>
            <span className="mt-0.5 block truncate text-sm font-bold text-[var(--color-main)]">
              {suggestedAchievement.title}
            </span>
            <span className="mt-1 block text-xs text-[var(--color-secondary)]">
              {t("how_to_earn")}
            </span>
          </span>
          <Info
            size={18}
            aria-hidden="true"
            className="shrink-0 text-[var(--color-secondary)]"
          />
        </button>
      ) : (
        <div className="border-t border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-4">
          <p className="text-sm font-bold text-[var(--color-main)]">
            {t("collection_complete_title")}
          </p>
          <p className="mt-1 text-sm leading-6 text-[var(--color-secondary)]">
            {t("collection_complete_body")}
          </p>
        </div>
      )}
    </section>
  );
}
