"use client";

import { useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { MentorshipStudentReportDto } from "@mentor/types";
import { INSET_GROUP_CLASS, InsetSection } from "@/components/mentorship/coach-ui";
import { addDaysIso, todayLocalIso } from "./composer-dates";

/** The report's mood window (`REPORT_MOOD_WINDOW_DAYS`). */
const WINDOW_DAYS = 14;

/** Check-ins are 1–5; anything else would name a label that does not exist. */
const levelOf = (level: number) => Math.min(5, Math.max(1, Math.round(level)));

/**
 * Two weeks of check-ins as a strip of bars, with the latest one in words. A number alone ("4")
 * meant nothing without the scale beside it; a word does, and a blank day stays visibly blank.
 */
export function ReportMood({ report }: { report: MentorshipStudentReportDto }) {
  const t = useTranslations("mentorship");
  const locale = useLocale();
  const dayFormat = useMemo(
    () => new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", timeZone: "UTC" }),
    [locale],
  );
  const entries = report.moodTrend;

  if (entries.length === 0) {
    return (
      <InsetSection title={t("report_mood")}>
        <p className={`${INSET_GROUP_CLASS} coach-body px-4 py-3.5 text-[var(--color-secondary)]`}>
          {t("report_mood_empty")}
        </p>
      </InsetSection>
    );
  }

  const day = (iso: string) => dayFormat.format(new Date(`${iso}T00:00:00.000Z`));
  const levels = new Map(entries.map((entry) => [entry.date, levelOf(entry.level)]));
  const latest = entries.reduce((a, b) => (b.date > a.date ? b : a));
  const today = todayLocalIso();
  const days = Array.from({ length: WINDOW_DAYS }, (_, index) =>
    addDaysIso(today, index - (WINDOW_DAYS - 1)),
  );

  return (
    <InsetSection title={t("report_mood")}>
      <div className={`${INSET_GROUP_CLASS} flex flex-wrap items-end justify-between gap-6 p-4`}>
        <div className="flex min-w-0 flex-col gap-2">
          <div aria-hidden className="flex h-14 items-end gap-1.5 sm:gap-2">
            {days.map((date) => {
              const level = levels.get(date);
              return level === undefined ? (
                <span key={date} className="h-[3px] w-3 rounded-sm bg-[var(--color-border)] sm:w-3.5" />
              ) : (
                <span
                  key={date}
                  className={`w-3 rounded-t sm:w-3.5 ${
                    date === latest.date ? "bg-[var(--color-main)]" : "bg-[var(--color-secondary)]"
                  }`}
                  style={{ height: `${(level / 5) * 100}%` }}
                />
              );
            })}
          </div>
          <p className="coach-footnote text-[var(--color-secondary)]">{t("report_mood_window")}</p>
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
        </div>
        <div className="flex flex-col items-end gap-0.5">
          <span className="coach-title text-[var(--color-main)]">
            {t(`report_mood_level_${levelOf(latest.level)}`)}
          </span>
          <span className="coach-footnote text-[var(--color-secondary)]">
            {t("report_mood_last", { date: day(latest.date) })}
          </span>
        </div>
      </div>
    </InsetSection>
  );
}
