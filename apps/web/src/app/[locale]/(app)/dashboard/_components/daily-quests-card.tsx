"use client";

import { useTranslations } from "next-intl";
import {
  CalendarCheck,
  ChevronRight,
  Clock3,
  Heart,
  ListChecks,
  type LucideIcon,
} from "lucide-react";
import type { QuestAction, QuestProgressView } from "@mentor/types";
import { ChestIcon } from "./today-path";
import { CHEST_QUEST_ID } from "./today-path-model";
import { PANEL_CARD, PANEL_CARD_TITLE, PANEL_TEXT_LINK } from "./panel-styles";

const WELL_BY_ACTION: Partial<Record<NonNullable<QuestAction>, [LucideIcon, string]>> = {
  plan: [CalendarCheck, "bg-[var(--play-well-peri)] text-[var(--play-selected-ink)]"],
  "study-session": [Clock3, "bg-[var(--play-well-blue)] text-[var(--play-selected-ink)]"],
  "mood-checkin": [Heart, "bg-[var(--play-well-coral)] text-[var(--color-streak)]"],
};
const DEFAULT_WELL: [LucideIcon, string] = [
  ListChecks,
  "bg-[var(--play-well-violet)] text-[var(--color-chip-text)]",
];
const DONE_WELL =
  "bg-[color-mix(in_srgb,var(--color-success)_16%,var(--color-surface))] text-[var(--color-success)]";

/**
 * Today's ritual quests with their progress, and the weekly chest. The list only shows; acting on a
 * quest lives in the full quest sheet ("Tümü"), which also carries the rewarded-ad offer. Economy
 * off (404) → no quests → no card.
 */
export function DailyQuestsCard({
  quests,
  onOpenAll,
}: {
  quests: QuestProgressView[] | null;
  onOpenAll: () => void;
}) {
  const t = useTranslations("panel");
  if (!quests) return null;
  const daily = quests.filter((quest) => quest.category === "daily_ritual");
  const chest = quests.find((quest) => quest.id === CHEST_QUEST_ID);
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
          <span className="text-[13px] font-bold tabular-nums text-[var(--color-secondary)]">
            {t("quests_progress", { done, total: daily.length })}
          </span>
        ) : null}
      </div>

      {daily.length > 0 ? (
        <ul className="flex flex-col gap-3.5">
          {daily.map((quest) => (
            <QuestLine key={quest.id} quest={quest} />
          ))}
        </ul>
      ) : null}

      {chest?.progressTarget ? (
        <p className="flex items-center gap-2.5 rounded-xl bg-[color-mix(in_srgb,var(--color-streak-core)_24%,var(--color-surface))] px-3 py-2.5 text-[13px] font-extrabold text-[var(--color-main)]">
          <ChestIcon className="size-5 shrink-0 text-[color-mix(in_srgb,var(--color-star)_40%,var(--color-main))]" />
          <span className="min-w-0 flex-1">
            {chest.completed
              ? t("quests_chest_open")
              : t("quests_chest", {
                  current: Math.min(chest.progressCurrent ?? 0, chest.progressTarget),
                  target: chest.progressTarget,
                })}
          </span>
          <span className="shrink-0 tabular-nums">
            {t("quests_chest_reward", { reward: chest.rewardAmount })}
          </span>
        </p>
      ) : null}

      <button
        type="button"
        onClick={onOpenAll}
        className={`${PANEL_TEXT_LINK} -mb-2 self-start`}
      >
        {t("quests_open_all")}
        <ChevronRight className="size-4" aria-hidden />
      </button>
    </section>
  );
}

function QuestLine({ quest }: { quest: QuestProgressView }) {
  const economyT = useTranslations("economy");
  const target = Math.max(quest.progressTarget ?? 1, 1);
  const current = quest.completed ? target : Math.min(quest.progressCurrent ?? 0, target);
  const [Icon, well] = (quest.action && WELL_BY_ACTION[quest.action]) || DEFAULT_WELL;
  const reward =
    quest.rewardUnit === "XP"
      ? economyT("quest_reward_xp", { count: quest.rewardAmount })
      : quest.rewardUnit === "COIN"
        ? economyT("quest_reward_coin", { count: quest.rewardAmount })
        : null;

  return (
    <li className="flex items-center gap-3">
      <span
        className={`grid size-10 shrink-0 place-items-center rounded-xl ${quest.completed ? DONE_WELL : well}`}
        aria-hidden
      >
        <Icon className="size-5" strokeWidth={2.2} />
      </span>
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
        <div
          role="progressbar"
          aria-label={quest.title}
          aria-valuemin={0}
          aria-valuemax={target}
          aria-valuenow={current}
          className="mt-1.5 h-2 overflow-hidden rounded-full bg-[var(--play-track)]"
        >
          <span
            className={`block h-full rounded-full transition-[width] duration-500 motion-reduce:transition-none ${quest.completed ? "bg-[var(--color-success)]" : "bg-[var(--play-cta)]"}`}
            style={{ width: `${Math.round((current / target) * 100)}%` }}
          />
        </div>
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
