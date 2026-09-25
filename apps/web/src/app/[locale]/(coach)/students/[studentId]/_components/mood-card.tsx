"use client";

import { useFormatter, useTranslations } from "next-intl";
import type { MentorshipStudentReportDto } from "@mentor/types";
import { PANEL_CARD, PANEL_CARD_TITLE } from "@/components/panel/panel-styles";
import { shiftIso } from "./week-filmstrip-model";

/** The report's mood window (`REPORT_MOOD_WINDOW_DAYS`). */
const WINDOW_DAYS = 14;

/** Check-ins are 1–5; anything else would name a label that does not exist. */
const levelOf = (level: number) => Math.min(5, Math.max(1, Math.round(level)));

/**
 * "Ruh hali": two weeks of check-ins as bars, a blank day visibly blank, and the latest one in
 * words. A number alone ("4") meant nothing without its scale; a word does.
 */
export function MoodCard({
  report,
  today,
}: {
  report: MentorshipStudentReportDto;
  /** Europe/Istanbul `yyyy-mm-dd`. */
  today: string;
}) {
  const t = useTranslations("mentorship");
  const format = useFormatter();
  const entries = report.moodTrend;
  const day = (iso: string) =>
    format.dateTime(new Date(`${iso}T00:00:00.000Z`), { day: "numeric", month: "long", timeZone: "UTC" });

  const header = (
    <div className="flex items-baseline justify-between gap-3">
      <h2 id="mood-title" className={PANEL_CARD_TITLE}>
        {t("report_mood")}
      </h2>
      <span className="text-caption font-bold text-[var(--color-secondary)]">{t("mood_window")}</span>
    </div>
  );

  if (entries.length === 0) {
    return (
      <section className={`${PANEL_CARD} flex flex-col gap-3`} aria-labelledby="mood-title">
        {header}
        <p className="text-body-sm font-semibold text-[var(--color-body)]">{t("report_mood_empty")}</p>
      </section>
    );
  }

  const levels = new Map(entries.map((entry) => [entry.date, levelOf(entry.level)]));
  const latest = entries.reduce((a, b) => (b.date > a.date ? b : a));
  const days = Array.from({ length: WINDOW_DAYS }, (_, index) => shiftIso(today, index - (WINDOW_DAYS - 1)));

  return (
    <section className={`${PANEL_CARD} flex flex-col gap-4`} aria-labelledby="mood-title">
      {header}
      <div className="flex items-end gap-6">
        <div aria-hidden className="grid h-14 flex-1 grid-cols-14 items-end gap-1.5">
          {days.map((date) => {
            const level = levels.get(date);
            return level === undefined ? (
              <span key={date} className="h-1 rounded-full bg-[var(--play-track)]" />
            ) : (
              <span
                key={date}
                className="rounded-t-[var(--radius-card)] bg-[var(--color-chip-text)]"
                style={{ height: `${(level / 5) * 100}%` }}
              />
            );
          })}
        </div>
        <div className="flex shrink-0 flex-col">
          <span className="text-base font-black text-[var(--color-main)]">
            {t(`report_mood_level_${levelOf(latest.level)}`)}
          </span>
          <span className="text-caption font-semibold text-[var(--color-secondary)]">
            {t("report_mood_last", { date: day(latest.date) })}
          </span>
        </div>
      </div>
      <ul className="sr-only">
        {entries.map((entry) => (
          <li key={entry.date}>
            {t("report_mood_entry", {
              date: day(entry.date),
              level: t(`report_mood_level_${levelOf(entry.level)}`),
            })}
          </li>
        ))}
      </ul>
    </section>
  );
}
