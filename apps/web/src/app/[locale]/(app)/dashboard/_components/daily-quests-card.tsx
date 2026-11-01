"use client";

import { useTranslations } from "next-intl";
import { AltArrowRightIcon as ChevronRight } from "@solar-icons/react/linear/alt-arrow-right";
import type { QuestProgressView, WeeklyChestView } from "@mentor/types";
import { PANEL_CARD, PANEL_CARD_TITLE, PANEL_TEXT_LINK } from "@/components/panel/panel-styles";
import { ProgressLine } from "@/components/panel/progress-line";
import { ChestRow } from "@/components/weekly-chest/chest-row";
import { useEconomyEnabled } from "@/lib/use-economy-enabled";

/**
 * Today's ritual quests with their progress, and the weekly chest. The list only shows; acting on a
 * quest lives in the full quest sheet ("Tümü"), which also carries the rewarded-ad offer. The chest
 * row comes from its own endpoint and opens its sheet or scene.
 */
export function DailyQuestsCard({
  quests,
  chest,
  onOpenAll,
  onChestTap,
}: {
  quests: QuestProgressView[] | null;
  chest: WeeklyChestView | null;
  onOpenAll: () => void;
  onChestTap: (chest: WeeklyChestView) => void;
}) {
  const t = useTranslations("panel");
  const rewardsEnabled = useEconomyEnabled();
  const daily = (quests ?? []).filter((quest) => quest.category === "daily_ritual");
  if (daily.length === 0 && !chest) return null;
  const done = daily.filter((quest) => quest.completed).length;

  return (
    <section
      className={`${PANEL_CARD} flex flex-col gap-4`}
      aria-labelledby="panel-quests-title"
      data-testid="panel-quests-card"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="panel-quests-title" className={PANEL_CARD_TITLE}>
          {t("quests_title")}
        </h2>
        {daily.length > 0 ? (
          <span className="text-caption font-bold tabular-nums text-[var(--color-secondary)]">
            {t("quests_progress", { done, total: daily.length })}
          </span>
        ) : null}
      </div>

      {daily.length > 0 ? (
        <ul className="flex flex-col gap-3.5">
          {daily.map((quest) => (
            <QuestLine key={quest.id} quest={quest} rewardsEnabled={rewardsEnabled} />
          ))}
        </ul>
      ) : null}

      {chest ? <ChestRow chest={chest} onTap={() => onChestTap(chest)} /> : null}

      {quests ? (
        <button
          type="button"
          onClick={onOpenAll}
          className={`${PANEL_TEXT_LINK} -mb-2 self-start`}
        >
          {t("quests_open_all")}
          <ChevronRight size={16} className="size-4" aria-hidden />
        </button>
      ) : null}
    </section>
  );
}

function QuestLine({ quest, rewardsEnabled }: { quest: QuestProgressView; rewardsEnabled: boolean }) {
  const economyT = useTranslations("economy");
  const target = Math.max(quest.progressTarget ?? 1, 1);
  const current = quest.completed ? target : Math.min(quest.progressCurrent ?? 0, target);
  const reward =
    rewardsEnabled && quest.rewardUnit === "XP"
      ? economyT("quest_reward_xp", { count: quest.rewardAmount })
      : rewardsEnabled && quest.rewardUnit === "COIN"
        ? economyT("quest_reward_coin", { count: quest.rewardAmount })
        : null;

  return (
    <li className="flex items-center gap-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="truncate text-sm font-extrabold text-[var(--color-main)]">
            {quest.title}
          </span>
          {target > 1 && !quest.completed ? (
            <span className="shrink-0 text-xs font-bold tabular-nums text-[var(--color-secondary)]">
              {current}/{target}
            </span>
          ) : null}
        </div>
        <ProgressLine
          appearance="play"
          label={quest.title}
          value={current}
          max={target}
          complete={quest.completed}
          className="mt-1.5"
        />
      </div>
      {reward ? (
        <span
          className={`shrink-0 text-xs font-extrabold ${quest.completed ? "text-[var(--color-success)]" : "text-[var(--color-secondary)]"}`}
        >
          {reward}
        </span>
      ) : null}
    </li>
  );
}
