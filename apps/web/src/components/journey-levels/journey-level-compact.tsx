"use client";

import { useLocale, useTranslations } from "next-intl";
import type { CommunityLevelView, JourneyLevelKey } from "@mentor/types";

import { JourneyLevelProgressBar } from "./journey-level-progress";

type LevelNameKey = `levels.${JourneyLevelKey}.name`;

export function JourneyLevelCompact({ level }: { level: CommunityLevelView }) {
  const t = useTranslations("journey_levels");
  const locale = useLocale();
  const name = t(`levels.${level.key}.name` as LevelNameKey);
  const progress = level.progress;

  return (
    <div className="flex flex-col gap-1.5" data-journey-level-compact>
      <div className="flex items-center justify-between gap-3 text-xs text-[var(--color-secondary)]">
        <span className="min-w-0 truncate">
          {t("level_title", { tier: level.tier, name })}
        </span>
        {progress ? (
          <span className="shrink-0 tabular-nums">
            {progress.current.toLocaleString(locale)} / {progress.target.toLocaleString(locale)} XP
          </span>
        ) : null}
      </div>
      {progress ? (
        <JourneyLevelProgressBar
          progress={progress}
          ariaLabel={t("progress_aria", { name })}
          ariaValueText={t("progress_value", {
            current: progress.current,
            target: progress.target,
          })}
          className=""
        />
      ) : (
        <p className="text-xs leading-5 text-[var(--color-secondary)]">
          {t("complete_message")}
        </p>
      )}
    </div>
  );
}

