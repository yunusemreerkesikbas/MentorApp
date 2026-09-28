"use client";

import { useId } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import type { MentorshipWeeklyReportShareDto } from "@mentor/types";
import { durationLabel } from "@/app/[locale]/(coach)/students/[studentId]/_components/report-format";
import { CoachAvatar } from "@/components/mentorship/coach-identity";
import { PANEL_CARD, PANEL_CARD_TITLE, PANEL_HERO } from "@/components/panel/panel-styles";
import { ProgressLine } from "@/components/panel/progress-line";

type Report = MentorshipWeeklyReportShareDto;

/**
 * Emphasis, not identity (dataviz: one series is the point, the other is context): this week in the
 * activity ink, the week before as a quiet gray bar half as thick. The gray is a mix of the
 * secondary ink, so it holds in both themes; the numbers beside every bar carry the values.
 */
const NOW_FILL = "bg-[var(--chart-activity-2)]";
const PREV_FILL = "bg-[color-mix(in_srgb,var(--color-secondary)_45%,transparent)]";

const width = (value: number, max: number) =>
  `${max > 0 ? Math.round((Math.min(value, max) / max) * 100) : 0}%`;

/** The coach's words first, under their name, in the coach ink (DESIGN.md §2.5). */
export function EvaluationHero({ report }: { report: Report }) {
  const t = useTranslations("mentorship");
  const format = useFormatter();
  const titleId = useId();

  return (
    <section aria-labelledby={titleId} className={PANEL_HERO}>
      <div className="flex items-center gap-3.5">
        <CoachAvatar name={report.coachDisplayName} size="md" />
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-caption font-extrabold text-[var(--coach-accent)]">
            {t("my_weekly_report_coach_evaluation")}
          </span>
          <h2 id={titleId} className="text-lg font-extrabold leading-snug text-[var(--color-main)]">
            {report.coachDisplayName}
          </h2>
          <span className="text-caption font-semibold text-[var(--color-secondary)]">
            {t("my_weekly_report_shared_on", {
              date: format.dateTime(new Date(report.finalizedAt), { day: "numeric", month: "long" }),
            })}
          </span>
        </div>
      </div>
      {report.coachEvaluation ? (
        <blockquote className="whitespace-pre-wrap break-words rounded-[var(--radius-card)] bg-[var(--coach-accent-soft)] px-4 py-3.5 text-base font-semibold leading-relaxed text-[var(--coach-accent-ink)]">
          {report.coachEvaluation}
        </blockquote>
      ) : null}
    </section>
  );
}

function PairRow({
  label,
  now,
  before,
  nowText,
  beforeText,
  max,
}: {
  label: string;
  now: number;
  before: number;
  nowText: string;
  beforeText: string;
  max: number;
}) {
  const t = useTranslations("mentorship");
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_5.25rem] items-center gap-x-3.5 gap-y-2 border-t border-[var(--play-line)] py-3 first:border-t-0 sm:grid-cols-[8rem_minmax(0,1fr)_6rem]">
      <span className="col-span-full text-sm font-extrabold text-[var(--color-body)] sm:col-span-1">{label}</span>
      <div
        role="img"
        aria-label={t("my_weekly_report_pair_aria", { label, current: nowText, previous: beforeText })}
        className="flex flex-col gap-1.25"
      >
        <span className={`block h-3 rounded-full ${NOW_FILL}`} style={{ width: width(now, max) }} />
        <span className={`block h-1.5 rounded-full ${PREV_FILL}`} style={{ width: width(before, max) }} />
      </div>
      <span aria-hidden className="text-right tabular-nums">
        <span className="block text-base font-black leading-tight text-[var(--color-main)]">{nowText}</span>
        <span className="block text-xs font-bold text-[var(--color-secondary)]">{beforeText}</span>
      </span>
    </div>
  );
}

/** "Haftan, geçen haftayla": three paired bars (each with its sentence), then the plan as a line. */
export function WeekCompareCard({ snapshot, days }: { snapshot: Report["snapshot"]; days: number }) {
  const t = useTranslations("mentorship");
  const titleId = useId();
  const { current, previous } = snapshot;
  const rows = [
    {
      label: t("weekly_report_focus"),
      now: current.focusMinutes,
      before: previous.focusMinutes,
      nowText: durationLabel(t, current.focusMinutes),
      beforeText: durationLabel(t, previous.focusMinutes),
      max: Math.max(current.focusMinutes, previous.focusMinutes),
    },
    {
      label: t("weekly_report_sessions"),
      now: current.sessions,
      before: previous.sessions,
      nowText: String(current.sessions),
      beforeText: String(previous.sessions),
      max: Math.max(current.sessions, previous.sessions),
    },
    {
      label: t("weekly_report_active_days"),
      now: current.activeDays,
      before: previous.activeDays,
      nowText: `${current.activeDays}/${days}`,
      beforeText: `${previous.activeDays}/${days}`,
      max: days,
    },
  ];

  return (
    <section aria-labelledby={titleId} className={`${PANEL_CARD} flex flex-col gap-2.5`}>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <h2 id={titleId} className={PANEL_CARD_TITLE}>
          {t("my_weekly_report_compare_title")}
        </h2>
        <div aria-hidden className="flex items-center gap-4 text-xs font-bold text-[var(--color-secondary)]">
          <span className="inline-flex items-center gap-1.5">
            <span className={`inline-block h-2.5 w-4.5 rounded-full ${NOW_FILL}`} />
            {t("my_weekly_report_this_week")}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className={`inline-block h-1.5 w-4.5 rounded-full ${PREV_FILL}`} />
            {t("weekly_report_previous")}
          </span>
        </div>
      </div>
      <div>
        {rows.map((row) => (
          <PairRow key={row.label} {...row} />
        ))}
      </div>
      <div className="flex flex-col gap-2 border-t border-[var(--play-line)] pt-3.5">
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-extrabold text-[var(--color-body)]">{t("my_weekly_report_plan_title")}</span>
          {current.plannedTasks > 0 ? (
            <span className="text-caption font-extrabold tabular-nums text-[var(--color-main)]">
              {t("my_weekly_report_plan_count", { done: current.completedTasks, total: current.plannedTasks })}
            </span>
          ) : null}
        </div>
        {current.plannedTasks > 0 ? (
          <ProgressLine
            label={t("my_weekly_report_plan_count", { done: current.completedTasks, total: current.plannedTasks })}
            value={current.completedTasks}
            max={current.plannedTasks}
          />
        ) : (
          <p className="text-caption font-semibold text-[var(--color-secondary)]">{t("my_weekly_report_plan_none")}</p>
        )}
        {previous.plannedTasks > 0 ? (
          <p className="text-caption font-semibold text-[var(--color-secondary)]">
            {t("my_weekly_report_plan_previous", { done: previous.completedTasks, total: previous.plannedTasks })}
          </p>
        ) : null}
      </div>
    </section>
  );
}

/** This week's minutes per subject, each bar against the longest; the minutes are printed beside it. */
export function SubjectsCard({ report }: { report: Report }) {
  const t = useTranslations("mentorship");
  const titleId = useId();
  const subjects = report.snapshot.subjects.filter((subject) => subject.currentFocusMinutes > 0);
  const max = Math.max(0, ...subjects.map((subject) => subject.currentFocusMinutes));

  return (
    <section aria-labelledby={titleId} className={`${PANEL_CARD} flex flex-col gap-2`}>
      <h2 id={titleId} className={PANEL_CARD_TITLE}>
        {t("weekly_report_subjects")}
      </h2>
      {subjects.length === 0 ? (
        <p className="text-body-sm font-semibold text-[var(--color-secondary)]">{t("weekly_report_no_subjects")}</p>
      ) : (
        <ul>
          {subjects.map((subject) => (
            <li
              key={subject.subjectRef ?? "unclassified"}
              className="grid grid-cols-[minmax(0,7.5rem)_minmax(0,1fr)_5.5rem] items-center gap-3 py-2"
            >
              <span className="truncate text-sm font-extrabold text-[var(--color-body)]">
                {subject.subjectRef
                  ? (report.subjectNames[subject.subjectRef] ?? subject.subjectRef)
                  : t("weekly_report_unclassified")}
              </span>
              <span aria-hidden className="h-2.5 overflow-hidden rounded-full bg-[var(--play-track)]">
                <span
                  className={`block h-full rounded-full ${NOW_FILL}`}
                  style={{ width: width(subject.currentFocusMinutes, max) }}
                />
              </span>
              <span className="whitespace-nowrap text-right text-sm font-black tabular-nums text-[var(--color-main)]">
                {durationLabel(t, subject.currentFocusMinutes)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * The week's mock average as one number, with its change beside it. Up reads in the success ink
 * with an arrow; down stays secondary ink, never red: a lower net is not a verdict (the caveat
 * under it says why), and the product tone is anti-shaming (AGENTS.md §0).
 */
export function MocksCard({ mocks }: { mocks: Report["snapshot"]["mocks"] }) {
  const t = useTranslations("mentorship");
  const locale = useLocale();
  const titleId = useId();
  const net = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 });
  const signed = new Intl.NumberFormat(locale, { maximumFractionDigits: 2, signDisplay: "exceptZero" });
  const now = mocks.currentAttemptCount > 0 ? mocks.currentAverageNet : null;
  const before = mocks.previousAttemptCount > 0 ? mocks.previousAverageNet : null;
  const delta = now !== null && before !== null ? now - before : null;

  return (
    <section aria-labelledby={titleId} className={`${PANEL_CARD} flex flex-col gap-2`}>
      <h2 id={titleId} className={PANEL_CARD_TITLE}>
        {t("my_weekly_report_mocks_title")}
      </h2>
      {now !== null ? (
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="text-display font-black leading-none tabular-nums text-[var(--color-main)]">
            {net.format(now)}
          </span>
          <span className="text-body-sm font-semibold text-[var(--color-body)]">
            {t("my_weekly_report_mock_line", { count: mocks.currentAttemptCount })}
          </span>
          {delta !== null && delta !== 0 ? (
            <span
              className={`inline-flex items-center gap-1 text-sm font-extrabold tabular-nums ${delta > 0 ? "text-[var(--color-success)]" : "text-[var(--color-secondary)]"}`}
            >
              {delta > 0 ? (
                <ArrowUp aria-hidden className="size-4" strokeWidth={2} />
              ) : (
                <ArrowDown aria-hidden className="size-4" strokeWidth={2} />
              )}
              {t("my_weekly_report_mock_delta", { delta: signed.format(delta) })}
            </span>
          ) : null}
        </div>
      ) : (
        <p className="text-body-sm font-semibold text-[var(--color-secondary)]">{t("my_weekly_report_mock_none")}</p>
      )}
      <p className="text-caption font-semibold text-[var(--color-secondary)]">
        {before !== null
          ? t("my_weekly_report_mock_previous", { count: mocks.previousAttemptCount, average: net.format(before) })
          : t("my_weekly_report_mock_previous_none")}{" "}
        {t("weekly_report_mock_caveat")}
      </p>
    </section>
  );
}
