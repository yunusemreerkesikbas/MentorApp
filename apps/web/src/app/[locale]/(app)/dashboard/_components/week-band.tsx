"use client";

import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { Snowflake } from "lucide-react";
import type { FocusGoalDto, StreakWeekDayDto } from "@mentor/types";
import {
  formatWeekdayShort,
  todayIso,
} from "@/app/[locale]/(app)/plan/_components/plan-utils";

type DayState = "active" | "frozen" | "idle" | "future";

const DOT_CLASS: Record<DayState, string> = {
  active: "bg-[var(--color-streak-soft)]",
  frozen:
    "bg-[color-mix(in_srgb,var(--color-progress)_18%,var(--color-surface))] text-[var(--play-selected-ink)]",
  idle: "bg-[var(--play-track)]",
  future: "border-2 border-dashed border-[var(--play-line)]",
};

/**
 * This week, Monday to Sunday, as the streak walk saw it (`streak.week`: same calendar basis as
 * `currentStreak`, so the band can never contradict the number beside it). A frozen day reads as
 * kept, not missed; days after today are "not yet", never failures.
 */
export function WeekBand({
  week,
  streak,
  focusGoal,
}: {
  week: StreakWeekDayDto[];
  streak: number;
  focusGoal: FocusGoalDto;
}) {
  const t = useTranslations("panel");
  const locale = useLocale();
  const today = todayIso();

  return (
    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-t border-[var(--play-line)] bg-[color-mix(in_srgb,var(--play-track)_35%,var(--color-surface))] px-4 py-3.5 sm:px-7">
      <ol className="flex gap-1 sm:gap-1.5" aria-label={t("week_band_label")}>
        {week.map((day) => {
          const state: DayState = day.active
            ? "active"
            : day.frozen
              ? "frozen"
              : day.date > today
                ? "future"
                : "idle";
          const isToday = day.date === today;
          const weekday = formatWeekdayShort(day.date, locale);
          return (
            <li
              key={day.date}
              className="flex w-7 flex-col items-center gap-1 sm:w-10"
            >
              <span
                className={[
                  "grid size-6 place-items-center rounded-full sm:size-[30px]",
                  DOT_CLASS[state],
                  isToday ? "shadow-[0_0_0_2px_var(--color-streak)]" : "",
                ].join(" ")}
                aria-hidden
              >
                {state === "active" ? (
                  <Image
                    src="/img/flame.png"
                    alt=""
                    width={16}
                    height={16}
                    className="size-3.5 sm:size-4"
                    draggable={false}
                  />
                ) : state === "frozen" ? (
                  <Snowflake className="size-3.5" strokeWidth={2.4} />
                ) : null}
              </span>
              <span
                className={`text-micro font-extrabold ${isToday ? "text-[var(--color-streak)]" : "text-[var(--color-secondary)]"}`}
                aria-hidden
              >
                {weekday}
              </span>
              <span className="sr-only">
                {t(`week_day_${state}`, { day: weekday })}
                {isToday ? `, ${t("week_day_today")}` : ""}
              </span>
            </li>
          );
        })}
      </ol>

      {/* On a phone this wraps under the days instead of being squeezed out of the card. */}
      <div className="ml-auto flex shrink-0 flex-col items-end gap-0.5 text-right">
        <span className="flex items-center gap-1.5 text-base font-black text-[var(--color-main)]">
          <Image
            src="/img/flame.png"
            alt=""
            width={18}
            height={18}
            className="size-[18px]"
            draggable={false}
          />
          <span className="tabular-nums">{t("week_band_streak", { count: streak })}</span>
        </span>
        {focusGoal.goalMinutes != null ? (
          <span className="text-xs font-bold tabular-nums text-[var(--color-secondary)]">
            {t("week_band_goal", {
              done: focusGoal.focusMinutesToday,
              goal: focusGoal.goalMinutes,
            })}
          </span>
        ) : focusGoal.focusMinutesToday > 0 ? (
          <span className="text-xs font-bold tabular-nums text-[var(--color-secondary)]">
            {t("week_band_focus", { minutes: focusGoal.focusMinutesToday })}
          </span>
        ) : null}
      </div>
    </div>
  );
}
