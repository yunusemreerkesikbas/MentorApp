"use client";

import { useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { MentorshipReportPlanTaskDto } from "@mentor/types";
import { INSET_GROUP_CLASS, InsetSection } from "@/components/mentorship/coach-ui";
import { todayLocalIso } from "./composer-dates";
import { buildWeekStrip, summarizeMine } from "./week-strip";

/** Past three marks a day reads as a smudge; the rest is a count. */
const MAX_MARKS = 3;

const DONE_MARK = "size-2 rounded-full bg-[var(--color-main)]";
const PENDING_MARK = "size-2 rounded-full shadow-[inset_0_0_0_1.5px_var(--coach-tertiary)]";

/**
 * "Did they do what was planned this week", at a glance, above the numbers. Every task counts, the
 * student's own included; the sentence underneath is the part about the coach.
 */
export function ReportWeekStrip({ tasks }: { tasks: readonly MentorshipReportPlanTaskDto[] }) {
  const t = useTranslations("mentorship");
  const locale = useLocale();
  const days = useMemo(() => buildWeekStrip(tasks, todayLocalIso()), [tasks]);
  const mine = useMemo(() => summarizeMine(tasks), [tasks]);
  const weekdayFormat = useMemo(
    () => new Intl.DateTimeFormat(locale, { weekday: "short" }),
    [locale],
  );
  const dayFormat = useMemo(
    () => new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "long" }),
    [locale],
  );

  return (
    <InsetSection title={t("report_week_title")}>
      <div className={`${INSET_GROUP_CLASS} divide-y divide-[var(--color-border)]`}>
        <ol className="grid grid-cols-7 gap-1 px-2 py-3">
          {days.map((day) => {
            const date = new Date(`${day.date}T00:00:00`);
            const marks: ("done" | "pending")[] = [];
            for (let i = 0; i < Math.min(day.done, MAX_MARKS); i += 1) marks.push("done");
            while (marks.length < Math.min(day.done + day.pending, MAX_MARKS)) marks.push("pending");
            const extra = day.done + day.pending - marks.length;
            return (
              <li
                key={day.date}
                aria-current={day.isToday ? "date" : undefined}
                className={`flex flex-col items-center gap-2 rounded-[var(--radius-card)] py-1.5 ${
                  day.isToday ? "bg-[var(--color-surface-container)]" : ""
                }`}
              >
                <span className="sr-only">
                  {t("report_week_day_label", {
                    day: dayFormat.format(date),
                    done: day.done,
                    pending: day.pending,
                  })}
                </span>
                <span
                  aria-hidden
                  className={`coach-caption ${
                    day.isToday
                      ? "font-semibold text-[var(--color-main)]"
                      : "text-[var(--color-secondary)]"
                  }`}
                >
                  {weekdayFormat.format(date)}
                </span>
                <span
                  aria-hidden
                  className={`coach-body grid size-8 place-items-center rounded-full font-semibold tabular-nums ${
                    day.isToday
                      ? "bg-[var(--color-accent)] text-[var(--color-btn-label)]"
                      : "text-[var(--color-main)]"
                  }`}
                >
                  {date.getDate()}
                </span>
                <span aria-hidden className="flex h-2 items-center gap-1">
                  {marks.map((kind, index) => (
                    <span key={index} className={kind === "done" ? DONE_MARK : PENDING_MARK} />
                  ))}
                  {extra > 0 ? (
                    <span className="coach-caption text-[var(--color-secondary)]">+{extra}</span>
                  ) : null}
                </span>
              </li>
            );
          })}
        </ol>
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-2.5">
          <p className="coach-body text-[var(--color-body)]">
            {mine.total > 0
              ? t("report_mine_done", { done: mine.done, total: mine.total })
              : t("report_week_none_from_you")}
          </p>
          <span aria-hidden className="coach-footnote flex items-center gap-3 text-[var(--color-secondary)]">
            <span className="inline-flex items-center gap-1.5">
              <span className={DONE_MARK} />
              {t("report_week_done")}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className={PENDING_MARK} />
              {t("report_week_pending")}
            </span>
          </span>
        </div>
      </div>
    </InsetSection>
  );
}
