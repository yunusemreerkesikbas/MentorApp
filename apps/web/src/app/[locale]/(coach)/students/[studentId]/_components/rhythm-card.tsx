"use client";

import { useMemo } from "react";
import { Flame } from "lucide-react";
import { useFormatter, useTranslations, type DateTimeFormatOptions } from "next-intl";
import type { MentorshipStudentReportDto } from "@mentor/types";
import { PANEL_CARD, PANEL_CARD_TITLE } from "@/components/panel/panel-styles";
import { ActivityLegend, FUTURE_CELL_CLASS } from "../../../_components/activity-strip";
import { ACTIVITY_TONE_CLASS, activityTone } from "../../../_components/activity-tone";
import { durationLabel, hasTrace } from "./report-format";
import { buildRhythm } from "./week-filmstrip-model";

const CELL = "size-7.5 rounded-[var(--radius-card)]";

/**
 * "Çalışma ritmi": four calendar weeks of focus drawn on the roster's ramp, rows aligned with the
 * week above, then the totals and the streak. The 28-day numbers live here and nowhere else.
 */
export function RhythmCard({
  report,
  today,
}: {
  report: MentorshipStudentReportDto;
  /** Europe/Istanbul `yyyy-mm-dd`. */
  today: string;
}) {
  const t = useTranslations("mentorship");
  const format = useFormatter();
  const rhythm = useMemo(
    () => buildRhythm(report.dailyFocusMinutes28d, today),
    [report.dailyFocusMinutes28d, today],
  );
  const { currentStreak, longestStreak } = report.activity;
  const day = (iso: string, options: DateTimeFormatOptions) =>
    format.dateTime(new Date(`${iso}T00:00:00.000Z`), { ...options, timeZone: "UTC" });

  return (
    <section className={`${PANEL_CARD} flex flex-col gap-4`} aria-labelledby="rhythm-title">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="rhythm-title" className={PANEL_CARD_TITLE}>
          {t("rhythm_title")}
        </h2>
        <span className="text-caption font-bold text-[var(--color-secondary)]">{t("rhythm_window")}</span>
      </div>

      <div className="flex flex-col gap-5 sm:flex-row sm:flex-wrap sm:items-center sm:gap-9">
        <div className="flex flex-col gap-1.5">
          <div aria-hidden className="grid grid-cols-7 gap-1.5">
            {rhythm.cells.slice(0, 7).map((cell) => (
              <span key={cell.date} className="text-center text-micro font-extrabold text-[var(--color-secondary)]">
                {day(cell.date, { weekday: "short" })}
              </span>
            ))}
          </div>
          <div
            role="img"
            aria-label={t("rhythm_grid_label", {
              activeDays: rhythm.activeDays,
              duration: durationLabel(t, rhythm.totalMinutes),
            })}
            className="grid grid-cols-7 gap-1.5"
          >
            {rhythm.cells.map((cell) => (
              <span
                key={cell.date}
                title={
                  cell.minutes === null
                    ? undefined
                    : t("activity_cell", {
                        date: day(cell.date, { weekday: "short", day: "numeric", month: "short" }),
                        minutes: cell.minutes,
                      })
                }
                className={`${CELL} ${cell.minutes === null ? FUTURE_CELL_CLASS : ACTIVITY_TONE_CLASS[activityTone(cell.minutes)]}`}
              />
            ))}
          </div>
        </div>

        {hasTrace(report) ? (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <span className="text-display font-black leading-none tabular-nums text-[var(--color-main)]">
                {durationLabel(t, rhythm.totalMinutes)}
              </span>
              <span className="text-caption font-semibold text-[var(--color-secondary)]">
                {t("rhythm_totals", { activeDays: rhythm.activeDays })}
              </span>
            </div>
            <div className="flex items-center gap-2.5">
              <span
                aria-hidden
                className="grid size-9 place-items-center rounded-full bg-[var(--color-streak-soft)] text-[var(--color-streak)]"
              >
                <Flame className="size-4.5" />
              </span>
              <span className="flex flex-col">
                <span className="text-base font-black text-[var(--color-main)]">
                  {currentStreak > 0 ? t("row_streak", { count: currentStreak }) : t("rhythm_streak_none")}
                </span>
                <span className="text-caption font-semibold text-[var(--color-secondary)]">
                  {t("rhythm_streak_longest", { count: longestStreak })}
                </span>
              </span>
            </div>
          </div>
        ) : (
          <p className="max-w-72 text-body-sm font-semibold text-[var(--color-body)]">{t("rhythm_new")}</p>
        )}
      </div>

      <ActivityLegend futureLabel={t("rhythm_legend_future")} />
    </section>
  );
}
