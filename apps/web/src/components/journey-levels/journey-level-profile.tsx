"use client";

import { useState } from "react";
import { AnimatePresence } from "framer-motion";
import { useLocale, useTranslations } from "next-intl";
import type {
  CommunityLevelView,
  JourneyLevelChapterId,
  JourneyLevelKey,
} from "@mentor/types";

import { JourneyLevelGuide } from "./journey-level-guide";
import { JourneyLevelMedallion } from "./journey-level-medallion";
import { JourneyLevelProgressBar } from "./journey-level-progress";
import { JourneySpotlightScene } from "./spotlight/journey-spotlight-scene";

type LevelNameKey = `levels.${JourneyLevelKey}.${"name" | "story"}`;
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
  const [spotlightOpen, setSpotlightOpen] = useState(false);
  const name = t(`levels.${level.key}.name` as LevelNameKey);
  const story = t(`levels.${level.key}.story` as LevelNameKey);
  const chapterLabel = t(`chapters.${level.chapter}.label` as ChapterLabelKey);

  return (
    <div data-journey-level-profile className="relative">
      <div className="pr-12">
        <h2 className="text-base font-bold leading-6">{t("title")}</h2>
        <JourneyLevelGuide level={level} isOwner={isOwner} />
      </div>

      <div className="mt-4 flex items-center gap-3.5">
        {/* Only the owner gets the scene: a cinematic reads "you earned this", which is the wrong
            sentence on someone else's profile. */}
        {isOwner ? (
          <button
            type="button"
            onClick={() => setSpotlightOpen(true)}
            aria-label={t("spotlight_open", { name })}
            className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-soft)]"
          >
            <JourneyLevelMedallion levelKey={level.key} current className="size-20" />
          </button>
        ) : (
          <JourneyLevelMedallion levelKey={level.key} current className="size-20" />
        )}
        <div className="min-w-0">
          <p className="text-xl font-bold leading-7 text-[var(--color-main)]">
            {t("level_title", { tier: level.tier, name })}
          </p>
          <p className="mt-1 text-xs font-bold uppercase tracking-wide text-[var(--color-accent)]">
            {chapterLabel}
          </p>
        </div>
      </div>

      <p className="mt-3 text-sm leading-5 text-[var(--color-secondary)]">{story}</p>

      {isOwner && level.progress ? (
        <div className="mt-4">
          <div className="flex items-center justify-between gap-3 text-xs text-[var(--color-secondary)]">
            <span>{t("progress_label")}</span>
            <span className="font-bold tabular-nums text-[var(--color-main)]">
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
        </div>
      ) : !level.progress ? (
        <p className="mt-3 text-sm leading-5 text-[var(--color-secondary)]">
          {t("complete_message")}
        </p>
      ) : null}

      <AnimatePresence>
        {spotlightOpen ? (
          <JourneySpotlightScene
            key="journey-spotlight"
            mode="replay"
            level={level}
            onClose={() => setSpotlightOpen(false)}
          />
        ) : null}
      </AnimatePresence>
    </div>
  );
}
