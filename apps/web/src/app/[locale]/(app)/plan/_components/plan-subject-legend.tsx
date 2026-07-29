"use client";

import type { PlanTaskDto } from "@mentor/types";
import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { PlanProgress } from "./plan-progress";
import { planEventColor } from "@/lib/plan-event-colors";
import {
  formatPlannedMinutes,
  summarizeSubjectMonth,
  type PlanSubjectSummary,
} from "@/lib/plan-subject-summary";
import { formatDateLabel, todayIso } from "./plan-utils";

/**
 * Subject legend for the Ay board — and the only place the color coding explains itself.
 *
 * Doubles as the highlight control: tapping a subject dims every other event so its spread across
 * the month is readable at a glance. Deliberately NOT a toolbar filter button — the legend has to
 * exist anyway to decode the colors, so it carries the interaction for free.
 */
export function PlanSubjectLegend({
  monthKey,
  tasksByDate,
  activeSubject,
  onSelect,
}: {
  /** yyyy-mm of the board — entries outside it are the grid's spill days and don't count. */
  monthKey: string;
  tasksByDate: Record<string, PlanTaskDto[]>;
  activeSubject: string | null;
  onSelect: (subject: string | null) => void;
}) {
  const t = useTranslations("plan");
  const locale = useLocale();
  const today = todayIso();
  /** Desktop pointer/keyboard focus; the mobile strip follows `activeSubject` instead. */
  const [peekedSubject, setPeekedSubject] = useState<string | null>(null);

  const subjects = useMemo(() => {
    const counts = new Map<string, number>();
    for (const [iso, tasks] of Object.entries(tasksByDate)) {
      if (iso.slice(0, 7) !== monthKey) continue;
      for (const task of tasks) {
        const subject = task.subject?.trim();
        if (!subject) continue;
        counts.set(subject, (counts.get(subject) ?? 0) + 1);
      }
    }
    return [...counts.entries()]
      .map(([subject, count]) => ({ subject, count }))
      .sort((a, b) => b.count - a.count || a.subject.localeCompare(b.subject, "tr"));
  }, [tasksByDate, monthKey]);

  /** Desktop hover/focus wins; otherwise the picked subject drives the mobile strip. */
  const summarySubject = peekedSubject ?? activeSubject;
  const summary = useMemo(
    () =>
      summarySubject
        ? summarizeSubjectMonth(summarySubject, tasksByDate, monthKey, today)
        : null,
    [summarySubject, tasksByDate, monthKey, today],
  );

  if (subjects.length === 0) return null;

  return (
    <div
      role="group"
      aria-label={t("calendar_legend_aria")}
      className="relative flex shrink-0 flex-wrap items-center gap-1.5 border-t pt-3"
      style={{ borderColor: "color-mix(in srgb, var(--color-main) 8%, transparent)" }}
    >
      {subjects.map(({ subject, count }) => {
        const color = planEventColor(subject);
        const active = subject === activeSubject;
        return (
          <button
            key={subject}
            type="button"
            aria-pressed={active}
            onClick={() => onSelect(active ? null : subject)}
            onMouseEnter={() => setPeekedSubject(subject)}
            onMouseLeave={() => setPeekedSubject(null)}
            onFocus={() => setPeekedSubject(subject)}
            onBlur={() => setPeekedSubject(null)}
            className="flex min-h-9 cursor-pointer items-center gap-1.5 rounded-full border px-2.5 text-xs transition-[opacity,box-shadow,transform,filter] duration-[260ms] ease-[cubic-bezier(0.22,1,0.36,1)] focus-visible:outline-none focus-visible:ring-2 motion-reduce:transform-none motion-reduce:duration-150"
            style={{
              backgroundColor: active ? color.bg : "transparent",
              borderColor: active
                ? color.bar
                : "color-mix(in srgb, var(--color-main) 12%, transparent)",
              // The legend is part of the same scene: the picked chip lifts and glows exactly
              // like the events it lit up, the rest fade back with them.
              opacity: activeSubject && !active ? 0.45 : 1,
              filter: activeSubject && !active ? "saturate(0.35)" : undefined,
              transform: active ? "translateY(-1px)" : undefined,
              boxShadow: active
                ? `0 4px 12px color-mix(in srgb, ${color.bar} 32%, transparent)`
                : undefined,
            }}
          >
            <span
              aria-hidden
              className="h-3 w-1 shrink-0 rounded-full"
              style={{ backgroundColor: color.bar }}
            />
            <span style={{ color: "var(--color-main)" }}>{subject}</span>
            <span className="tabular-nums" style={{ color: "var(--color-secondary)" }}>
              {count}
            </span>
          </button>
        );
      })}

      {activeSubject ? (
        <button
          type="button"
          onClick={() => onSelect(null)}
          className="min-h-9 cursor-pointer px-2 text-xs font-semibold underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2"
          style={{ color: "var(--color-accent)" }}
        >
          {t("calendar_legend_clear")}
        </button>
      ) : null}

      {/* Desktop: a card above the legend row, so it never covers the board it describes. */}
      {summary && summarySubject ? (
        <div
          role="tooltip"
          className="pointer-events-none absolute bottom-full left-0 z-20 mb-2 hidden w-64 flex-col gap-2 rounded-[var(--radius-card)] border border-white bg-white p-3 shadow-[var(--shadow-card)] lg:flex"
        >
          <SubjectSummaryBody
            subject={summarySubject}
            summary={summary}
            locale={locale}
            t={t}
          />
        </div>
      ) : null}

      {/* Mobile: no hover to lean on — the picked subject reports itself on one line. */}
      {activeSubject && summary && summary.total > 0 ? (
        <p
          className="w-full text-xs lg:hidden"
          style={{ color: "var(--color-secondary)" }}
        >
          {summaryStripText(summary, locale, t)}
        </p>
      ) : null}
    </div>
  );
}

type Translate = ReturnType<typeof useTranslations<"plan">>;

/** "4 gün · 3 sa 30 dk" — the parts that survive on one mobile line. */
function summaryStripText(
  summary: PlanSubjectSummary,
  locale: string,
  t: Translate,
): string {
  const parts = [
    t("legend_progress", { done: summary.done, total: summary.total }),
    t("legend_days", { count: summary.dayCount }),
  ];
  if (summary.plannedMinutes !== null) {
    parts.push(
      formatPlannedMinutes(summary.plannedMinutes, {
        hour: t("legend_hour_short"),
        minute: t("legend_minute_short"),
      }),
    );
  }
  if (summary.next) {
    parts.push(
      t("legend_next_short", {
        date: formatDateLabel(summary.next.date, locale, t("today"), {
          compact: true,
        }),
      }),
    );
  }
  return parts.join(" · ");
}

function SubjectSummaryBody({
  subject,
  summary,
  locale,
  t,
}: {
  subject: string;
  summary: PlanSubjectSummary;
  locale: string;
  t: Translate;
}) {
  const color = planEventColor(subject);
  const meta = [t("legend_days", { count: summary.dayCount })];
  if (summary.plannedMinutes !== null) {
    meta.push(
      formatPlannedMinutes(summary.plannedMinutes, {
        hour: t("legend_hour_short"),
        minute: t("legend_minute_short"),
      }),
    );
  }

  return (
    <>
      <p className="flex items-center gap-2 text-sm font-bold">
        <span
          aria-hidden
          className="h-3 w-1 shrink-0 rounded-full"
          style={{ backgroundColor: color.bar }}
        />
        <span
          className="min-w-0 truncate"
          style={{ color: "var(--color-main)", fontFamily: "var(--font-heading)" }}
        >
          {subject}
        </span>
      </p>

      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between gap-3 text-xs">
          <span style={{ color: "var(--color-main)" }}>
            {t("legend_progress", { done: summary.done, total: summary.total })}
          </span>
          <span className="tabular-nums" style={{ color: "var(--color-secondary)" }}>
            {t("progress_percent", { percent: summary.percent })}
          </span>
        </div>
        <PlanProgress value={summary.percent} />
      </div>

      <p className="text-xs" style={{ color: "var(--color-secondary)" }}>
        {meta.join(" · ")}
      </p>

      {summary.next ? (
        <p className="text-xs" style={{ color: "var(--color-body)" }}>
          <span style={{ color: "var(--color-secondary)" }}>
            {t("legend_next_label")}{" "}
          </span>
          {formatDateLabel(summary.next.date, locale, t("today"), { compact: true })}
          {" · "}
          {summary.next.title}
        </p>
      ) : (
        <p className="text-xs" style={{ color: "var(--color-secondary)" }}>
          {t("legend_next_none")}
        </p>
      )}
    </>
  );
}
