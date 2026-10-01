"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import type { AchievementCelebrationDto } from "@mentor/types";

import { AchievementScene } from "./scene/achievement-scene";

/**
 * Celebrates newly earned achievements with the "Işık Yandı" scene (DESIGN.md §9.1): one
 * achievement gets the whole film, a backfill summary deals its badges as a fan. The caller owns
 * the acknowledge: `onClose` marks them celebrated, `busy` and `error` report on that request.
 */
export function AchievementCelebration({
  celebration,
  busy,
  error = null,
  onClose,
}: {
  celebration: AchievementCelebrationDto;
  busy: boolean;
  error?: string | null;
  onClose: () => void;
}) {
  const t = useTranslations("achievements");
  // Stable across re-renders (busy, error): the scene re-aims its lights when the cards change.
  const cards = useMemo(
    () => celebration.items.map((item) => ({ artKey: item.artKey, title: item.title })),
    [celebration],
  );
  const first = celebration.items[0];
  if (!first) return null;

  const summary = celebration.kind === "BACKFILL_SUMMARY";
  const count = celebration.items.length;
  const celebrationKey = `${celebration.kind}:${celebration.items
    .map((achievement) => achievement.id)
    .join(":")}`;

  return (
    <AchievementScene
      key={celebrationKey}
      cards={cards}
      text={{
        hint: t("celebration_ignite"),
        eyebrow: summary
          ? t("history_eyebrow", { count })
          : t(`celebration_items.${first.id}.eyebrow`),
        title: summary ? t("history_title") : first.title,
        body: summary
          ? t("history_body", { count })
          : t(`celebration_items.${first.id}.body`),
        cta: t("continue"),
      }}
      igniteLabel={t("celebration_ignite_aria")}
      litAnnouncement={t("celebration_eyebrow")}
      moreLabel={(rest) => t("celebration_more", { count: rest })}
      busy={busy}
      error={error}
      onClose={onClose}
    />
  );
}
