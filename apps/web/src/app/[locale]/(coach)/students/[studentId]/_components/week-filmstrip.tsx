"use client";

import { Check } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import type { FilmDay } from "./week-filmstrip-model";

/** A two-hour day fills the column; more than that still reads as a full day. */
const FULL_DAY_MINUTES = 120;
/** Past three marks a day reads as a smudge; the rest is a count. */
const MAX_MARKS = 3;

type Mark = "coach-done" | "coach-pending" | "coach-future" | "own-done" | "own-pending";

const MARK_CLASS: Record<Mark, string> = {
  "coach-done": "grid size-5 place-items-center rounded-full bg-[var(--coach-accent)] text-[var(--color-bg)]",
  "coach-pending": "size-5 rounded-full border-2 border-[var(--coach-accent)]",
  "coach-future": "size-5 rounded-full border-2 border-dashed border-[var(--coach-accent)]",
  "own-done": "size-2.5 rounded-full bg-[var(--color-secondary)]",
  "own-pending": "size-2.5 rounded-full border-2 border-[var(--color-secondary)]",
};

function marksOf(day: FilmDay): Mark[] {
  const pending: Mark = day.kind === "future" ? "coach-future" : "coach-pending";
  return [
    ...Array<Mark>(day.coach.done).fill("coach-done"),
    ...Array<Mark>(day.coach.pending).fill(pending),
    ...Array<Mark>(day.own.done).fill("own-done"),
    ...Array<Mark>(day.own.pending).fill("own-pending"),
  ];
}

export function FilmMark({ mark }: { mark: Mark }) {
  return (
    <span aria-hidden className={`shrink-0 ${MARK_CLASS[mark]}`}>
      {mark === "coach-done" ? <Check className="size-3" strokeWidth={3.2} /> : null}
    </span>
  );
}

/**
 * The student's week drawn day by day (DESIGN.md §6.1 "Hafta şeridi"): the minutes as a bar, the
 * coach's tasks as ink-blue marks, the student's own as small dots, and the days to come as frames.
 * Each day is one sentence for a screen reader; the drawing is hidden from it.
 */
export function WeekFilmstrip({ days }: { days: readonly FilmDay[] }) {
  const t = useTranslations("mentorship");
  const format = useFormatter();
  const date = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

  return (
    <ol aria-label={t("week_film_label")} className="grid grid-cols-7 gap-1 sm:gap-1.5">
      {days.map((day) => {
        const marks = marksOf(day);
        const shown = marks.slice(0, MAX_MARKS);
        const extra = marks.length - shown.length;
        const name = format.dateTime(date(day.date), {
          weekday: "long",
          day: "numeric",
          month: "long",
          timeZone: "UTC",
        });
        const coachTotal = day.coach.done + day.coach.pending;
        const ownTotal = day.own.done + day.own.pending;
        const spoken = [
          day.minutes === null
            ? t("week_day_future", { day: name })
            : day.minutes > 0
              ? t("week_day_minutes", { day: name, minutes: day.minutes })
              : t("week_day_rest", { day: name }),
          coachTotal > 0 ? t("week_day_coach", { done: day.coach.done, total: coachTotal }) : null,
          ownTotal > 0 ? t("week_day_own", { done: day.own.done, total: ownTotal }) : null,
        ]
          .filter(Boolean)
          .join(" ");
        const height =
          day.minutes === null || day.minutes === 0
            ? null
            : `${Math.max(8, Math.round((Math.min(day.minutes, FULL_DAY_MINUTES) / FULL_DAY_MINUTES) * 100))}%`;

        return (
          <li
            key={day.date}
            aria-current={day.kind === "today" ? "date" : undefined}
            className={`flex min-w-0 flex-col items-center gap-2 rounded-[var(--radius-card)] px-0.5 py-2.5 ${day.kind === "today" ? "bg-[var(--play-selected)]" : ""}`}
          >
            <span className="sr-only">{spoken}</span>
            <span aria-hidden className="h-4 text-xs font-extrabold tabular-nums text-[var(--color-secondary)]">
              {day.minutes ? t("value_minutes", { count: day.minutes }) : ""}
            </span>
            <span aria-hidden className="flex h-22 w-full items-end justify-center">
              {day.minutes === null ? (
                <span className="h-full w-6 rounded-[var(--radius-card)] border-2 border-dashed border-[var(--play-line)] sm:w-7" />
              ) : height === null ? (
                <span className="h-1 w-6 rounded-full bg-[var(--play-track)] sm:w-7" />
              ) : (
                <span
                  className="w-6 rounded-t-[var(--radius-card)] bg-[var(--chart-activity-2)] sm:w-7"
                  style={{ height }}
                />
              )}
            </span>
            <span aria-hidden className="flex h-5 items-center justify-center gap-0.5 sm:gap-1">
              {shown.map((mark, index) => (
                <FilmMark key={index} mark={mark} />
              ))}
              {extra > 0 ? (
                <span className="text-micro font-extrabold text-[var(--color-secondary)]">+{extra}</span>
              ) : null}
            </span>
            {/* Stacked on a phone, where seven "Cmt 26" labels in a row would touch. */}
            <span
              aria-hidden
              className={`flex flex-col items-center whitespace-nowrap text-xs font-extrabold leading-tight sm:flex-row sm:gap-1 ${day.kind === "today" ? "text-[var(--play-selected-ink)]" : "text-[var(--color-secondary)]"}`}
            >
              {day.kind === "today" ? (
                t("week_today")
              ) : (
                <>
                  <span>{format.dateTime(date(day.date), { weekday: "short", timeZone: "UTC" })}</span>
                  <span>{date(day.date).getUTCDate()}</span>
                </>
              )}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/** The key to the marks, shown only when the week has any. Hidden from screen readers. */
export function FilmLegend() {
  const t = useTranslations("mentorship");
  return (
    <p
      aria-hidden
      className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-caption font-bold text-[var(--color-secondary)]"
    >
      <span className="inline-flex items-center gap-1.5">
        <FilmMark mark="coach-done" />
        {t("week_legend_coach_done")}
      </span>
      <span className="inline-flex items-center gap-1.5">
        <FilmMark mark="coach-pending" />
        {t("week_legend_coach_pending")}
      </span>
      <span className="inline-flex items-center gap-1.5">
        <FilmMark mark="own-pending" />
        {t("week_legend_own")}
      </span>
    </p>
  );
}
