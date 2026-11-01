"use client";

import { Coins, Sparkles } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { CheckIcon as Check } from "@solar-icons/react/linear/check";
import { NotebookIcon as Notebook } from "@solar-icons/react/bold/notebook";
import type { WeeklyChestView } from "@mentor/types";
import { ChestArt } from "./chest-art";
import { chestLamps, daysLeft } from "./weekly-chest-model";

const INSIDE_ROW =
  "flex items-center gap-3 rounded-[var(--radius-card)] bg-[color-mix(in_srgb,var(--color-streak-core)_16%,var(--color-surface))] px-3 py-2.5";

/** The chest while the week is still running: what counts, which days counted, what is inside. */
export function ChestInfoSheet({ chest }: { chest: WeeklyChestView }) {
  const t = useTranslations("weeklyChest");
  const format = useFormatter();
  const { reward } = chest;

  return (
    <div className="flex flex-col items-center gap-5 pb-2 text-center" data-testid="weekly-chest-sheet">
      <ChestArt open={false} lamps={chestLamps(chest)} className="w-36" />
      <p className="text-xl font-extrabold leading-snug text-[var(--color-main)]">
        {t("sheet_headline", { left: daysLeft(chest) })}
      </p>

      <ol className="flex justify-center gap-2" aria-label={t("sheet_days_label")}>
        {chest.days.map((day) => {
          const label = format.dateTime(new Date(`${day.date}T00:00:00Z`), { weekday: "short", timeZone: "UTC" });
          const today = day.date === chest.today;
          return (
            <li key={day.date} className="flex flex-col items-center gap-1.5">
              <span
                className={[
                  "grid size-9 place-items-center rounded-full",
                  day.active
                    ? "bg-[var(--color-streak-core)] text-[color-mix(in_srgb,var(--color-star)_25%,var(--color-main))]"
                    : "border-2 border-dashed border-[color-mix(in_srgb,var(--color-secondary)_35%,transparent)]",
                  today ? "ring-2 ring-[var(--play-cta)] ring-offset-2 ring-offset-[var(--color-surface)]" : "",
                ].join(" ")}
                aria-hidden
              >
                {day.active ? <Check size={18} className="size-[18px]" /> : null}
              </span>
              <span
                className={`text-xs font-bold ${today ? "text-[var(--color-main)]" : "text-[var(--color-secondary)]"}`}
                aria-hidden
              >
                {today ? t("today") : label}
              </span>
              <span className="sr-only">{day.active ? t("day_active", { day: label }) : t("day_idle", { day: label })}</span>
            </li>
          );
        })}
      </ol>

      <p className="text-sm font-bold text-[var(--color-secondary)]">{t("sheet_rule")}</p>

      <section className="w-full text-left" aria-labelledby="weekly-chest-inside">
        <h3
          id="weekly-chest-inside"
          className="text-xs font-black uppercase tracking-[0.08em] text-[var(--color-secondary)]"
        >
          {t("sheet_inside")}
        </h3>
        <ul className="mt-2 flex flex-col gap-2">
          <li className={INSIDE_ROW}>
            <Notebook size={22} className="size-[22px] shrink-0 text-[var(--play-selected-ink)]" aria-hidden />
            <span className="min-w-0">
              <span className="block text-sm font-extrabold text-[var(--color-main)]">{t("sheet_story_title")}</span>
              <span className="block text-caption font-bold text-[var(--color-secondary)]">{t("sheet_story_body")}</span>
            </span>
          </li>
          {reward ? (
            <li className={INSIDE_ROW}>
              {reward.unit === "COIN" ? (
                <Coins className="size-[22px] shrink-0 text-[color-mix(in_srgb,var(--color-star)_70%,var(--color-main))]" aria-hidden />
              ) : (
                <Sparkles className="size-[22px] shrink-0 text-[var(--color-star)]" aria-hidden />
              )}
              <span className="text-sm font-extrabold text-[var(--color-main)]">
                {t("reward", { amount: reward.amount, unit: reward.unit })}
              </span>
            </li>
          ) : null}
        </ul>
      </section>

      <p className="text-caption font-bold text-[var(--color-secondary)]">{t("sheet_footer")}</p>
    </div>
  );
}
