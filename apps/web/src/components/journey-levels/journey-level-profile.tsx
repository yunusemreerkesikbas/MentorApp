"use client";

import { useLocale, useTranslations } from "next-intl";
import type {
  CommunityLevelView,
  JourneyLevelChapterId,
  JourneyLevelKey,
} from "@mentor/types";

import { JourneyLevelGuide } from "./journey-level-guide";
import { JourneyLevelMedallion } from "./journey-level-medallion";
import { JourneyLevelProgressBar } from "./journey-level-progress";

type LevelNameKey = `levels.${JourneyLevelKey}.${"name" | "story" | "destination"}`;
type ChapterLabelKey = `chapters.${JourneyLevelChapterId}.label`;

export function JourneyLevelProfile({
  level,
  isOwner,
}: {
  level: CommunityLevelView;
  isOwner: boolean;
}) {
  const t = useTranslations("journey_levels");
  const locale = useLocale();
  const name = t(`levels.${level.key}.name` as LevelNameKey);
  const story = t(`levels.${level.key}.story` as LevelNameKey);
  const chapterLabel = t(`chapters.${level.chapter}.label` as ChapterLabelKey);
  const nextDestination = level.nextKey
    ? t(`levels.${level.nextKey}.destination` as LevelNameKey)
    : null;

  return (
    <div data-journey-level-profile className="relative">
      <div className="pr-12">
        <h2 className="text-base font-bold leading-6">{t("title")}</h2>
        <JourneyLevelGuide level={level} isOwner={isOwner} />
      </div>

      <div className="mt-2 flex flex-col items-center text-center">
        <JourneyLevelMedallion
          tier={level.tier}
          levelKey={level.key}
          current
          className="size-24"
        />
        <p className="mt-2 text-base font-bold text-[var(--color-btn-label)]">
          {t("level_title", { tier: level.tier, name })}
        </p>
        <p className="mt-1 text-xs font-bold uppercase tracking-wide text-[var(--color-progress-track)]">
          {chapterLabel}
        </p>
        <p className="mt-2 max-w-xs text-sm leading-5 text-[color-mix(in_srgb,var(--color-btn-label)_72%,transparent)]">
          {story}
        </p>
      </div>

      {isOwner && level.progress && nextDestination ? (
        <div className="mt-4">
          <div className="flex items-center justify-between gap-3 text-xs text-[color-mix(in_srgb,var(--color-btn-label)_70%,transparent)]">
            <span>{t("progress_label")}</span>
            <span className="tabular-nums">
              {level.progress.current.toLocaleString(locale)} / {level.progress.target.toLocaleString(locale)} XP
            </span>
          </div>
          <JourneyLevelProgressBar
            progress={level.progress}
            ariaLabel={t("progress_aria", { name })}
            ariaValueText={t("progress_value", {
              current: level.progress.current,
              target: level.progress.target,
            })}
          />
          <p className="mt-2 text-center text-xs font-semibold text-[var(--color-btn-label)]">
            {t("next_remaining", {
              destination: nextDestination,
              remaining: level.progress.remaining,
            })}
          </p>
        </div>
      ) : !level.progress ? (
        <p className="mt-4 text-center text-sm leading-5 text-[color-mix(in_srgb,var(--color-btn-label)_76%,transparent)]">
          {t("complete_message")}
        </p>
      ) : null}
    </div>
  );
}
