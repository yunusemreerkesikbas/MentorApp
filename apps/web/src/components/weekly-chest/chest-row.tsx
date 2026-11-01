"use client";

import { useTranslations } from "next-intl";
import type { WeeklyChestView } from "@mentor/types";
import { ChestArt } from "./chest-art";
import { chestLamps, daysLeft, weekCanStillFill } from "./weekly-chest-model";

const ROW =
  "flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-[var(--radius-card)] px-3 py-2.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]";
const GOLD_PILL =
  "shrink-0 rounded-full bg-[var(--color-streak-core)] px-5 py-2.5 text-sm font-black text-[color-mix(in_srgb,var(--color-star)_25%,var(--color-main))] shadow-[0_3px_0_color-mix(in_srgb,var(--color-star)_60%,var(--color-main)_20%)]";

/** The weekly chest's row in the panel quests card; the whole row is one button (sheet or scene). */
export function ChestRow({ chest, onTap }: { chest: WeeklyChestView; onTap: () => void }) {
  const t = useTranslations("weeklyChest");
  const reward = chest.reward ? t("reward", { amount: chest.reward.amount, unit: chest.reward.unit }) : null;
  const lamps = chestLamps(chest);

  if (chest.state === "READY") {
    return (
      <button
        type="button"
        onClick={onTap}
        data-testid="panel-chest-row"
        data-state="READY"
        className={`${ROW} border-2 border-[var(--color-streak-core)] bg-[color-mix(in_srgb,var(--color-streak-core)_42%,var(--color-surface))]`}
      >
        <ChestArt open={false} lamps={lamps} className="wc-hop w-12" />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-black text-[var(--color-main)]">
            {chest.carriedOver ? t("carried_title") : t("card_ready_title", { target: chest.target })}
          </span>
          <span className="block text-caption font-bold text-[var(--color-secondary)]">{t("card_ready_body")}</span>
        </span>
        <span className={GOLD_PILL}>{t("open")}</span>
      </button>
    );
  }

  if (chest.state === "OPENED") {
    return (
      <button
        type="button"
        onClick={onTap}
        data-testid="panel-chest-row"
        data-state="OPENED"
        className={`${ROW} bg-[color-mix(in_srgb,var(--color-streak-core)_18%,var(--color-surface))]`}
      >
        <ChestArt open className="w-10" />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-extrabold text-[var(--color-main)]">{t("card_opened_title")}</span>
          <span className="block text-caption font-bold text-[var(--color-secondary)]">{t("card_opened_body")}</span>
        </span>
        <span className="shrink-0 text-sm font-extrabold text-[var(--play-selected-ink)] underline underline-offset-4">
          {t("see_story")}
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onTap}
      data-testid="panel-chest-row"
      data-state="PROGRESS"
      className={`${ROW} bg-[color-mix(in_srgb,var(--color-streak-core)_24%,var(--color-surface))]`}
    >
      <ChestArt open={false} lamps={lamps} className="w-10" />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-extrabold text-[var(--color-main)]">{t("title")}</span>
        <span className="mt-1 flex items-center gap-1.5">
          {lamps.map((lit, index) => (
            <span
              key={index}
              className={`size-2 rounded-full ${lit ? "bg-[color-mix(in_srgb,var(--color-star)_60%,var(--color-streak))]" : "bg-[var(--color-border)]"}`}
              aria-hidden
            />
          ))}
          <span className="ml-1 text-xs font-bold tabular-nums text-[var(--color-secondary)]">
            {weekCanStillFill(chest) ? t("days_left", { left: daysLeft(chest) }) : t("days_left_missed")}
          </span>
        </span>
        {reward ? null : (
          <span className="mt-0.5 block text-xs font-bold text-[var(--color-secondary)]">{t("story_inside")}</span>
        )}
      </span>
      {reward ? (
        <span className="shrink-0 text-xs font-extrabold tabular-nums text-[var(--color-secondary)]">
          {reward}
        </span>
      ) : null}
    </button>
  );
}
