"use client";

import { useMemo } from "react";
import { CalendarPlus, PenLine } from "lucide-react";
import { useTranslations } from "next-intl";
import type { MentorshipStudentReportDto } from "@mentor/types";
import { Skeleton, SkeletonGroup } from "@mentor/ui";
import { CompanionBubble } from "@/components/panel/companion-bubble";
import {
  LEDGE,
  LEDGE_FILLED,
  LEDGE_TEXT_LINK,
  PANEL_HERO,
  PANEL_HERO_TITLE,
} from "@/components/panel/panel-styles";
import { firstName } from "@/lib/greeting";
import { worstFlag } from "../../../_components/flag-order";
import { durationLabel, hasTrace } from "./report-format";
import { FilmLegend, WeekFilmstrip } from "./week-filmstrip";
import { buildWeekFilm, weekSummary } from "./week-filmstrip-model";

/**
 * The student page's hero (DESIGN.md §6.1): this week in one sentence, drawn day by day, with the
 * one filled ledge, "Haftayı planla". The assistant speaks for a coach whose plan includes it;
 * otherwise the rule line says what the flags say, without a label.
 */
export function WeekHeroCard({
  report,
  today,
  brief,
  briefBusy,
  onPlan,
  onNote,
}: {
  report: MentorshipStudentReportDto;
  /** Europe/Istanbul `yyyy-mm-dd`. */
  today: string;
  brief: string | null;
  briefBusy: boolean;
  onPlan: () => void;
  onNote: () => void;
}) {
  const t = useTranslations("mentorship");
  const days = useMemo(
    () => buildWeekFilm(report.dailyFocusMinutes28d, report.planTasks, today),
    [report.dailyFocusMinutes28d, report.planTasks, today],
  );
  const summary = weekSummary(days);
  const name = firstName(report.studentDisplayName);
  const trace = hasTrace(report);
  const flag = worstFlag(report.riskFlags);
  const ai = !briefBusy && brief !== null;
  const hasMarks = days.some((day) => day.coach.done + day.coach.pending + day.own.done + day.own.pending > 0);

  const line = briefBusy
    ? t("round_ai_busy")
    : ai
      ? brief
      : !trace
        ? t("week_line_new", { name })
        : flag
          ? t("week_line_flag", { hint: t(`flag_${flag}_hint`), action: t(`action_${flag}`) })
          : t("week_line_calm", { name });

  return (
    <section className={PANEL_HERO} aria-labelledby="week-title" data-testid="week-hero">
      <CompanionBubble
        puhu="host"
        text={line}
        aiLabel={ai ? t("round_ai_label") : null}
        busy={briefBusy}
      />
      <h2 id="week-title" className={PANEL_HERO_TITLE}>
        {!trace
          ? t("week_title_new")
          : summary.minutes > 0
            ? t("week_title", { duration: durationLabel(t, summary.minutes) })
            : t("week_title_none")}
      </h2>

      <WeekFilmstrip days={days} />

      <div className="-mt-1 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <p className="text-body-sm font-extrabold text-[var(--color-body)]">
          {!trace
            ? t("week_tasks_new")
            : summary.coachTotal > 0
              ? t("week_tasks_mine", { done: summary.coachDone, total: summary.coachTotal })
              : t("week_tasks_none")}
        </p>
        {hasMarks ? <FilmLegend /> : null}
      </div>

      <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:gap-4">
        <button type="button" onClick={onPlan} className={`${LEDGE} ${LEDGE_FILLED} cursor-pointer`}>
          <CalendarPlus className="size-5" aria-hidden />
          {t("report_plan_week")}
        </button>
        <button
          type="button"
          onClick={onNote}
          className={`${LEDGE_TEXT_LINK} cursor-pointer gap-1.5 self-center sm:ml-auto`}
        >
          <PenLine className="size-4" aria-hidden />
          {t("week_leave_note")}
        </button>
      </div>
    </section>
  );
}

/** The hero's own loading shape: bubble, title, seven columns, ledge; a status for screen readers. */
export function WeekHeroSkeleton() {
  const t = useTranslations("mentorship");
  return (
    <SkeletonGroup label={t("loading")} className={PANEL_HERO}>
      <div className="flex items-start gap-3 sm:gap-4">
        <Skeleton className="size-[72px] shrink-0 rounded-full" />
        <Skeleton className="h-16 flex-1 rounded-[var(--play-radius)]" />
      </div>
      <Skeleton className="h-7 w-64 max-w-full rounded-[var(--radius-card)]" />
      <div className="grid grid-cols-7 gap-1.5">
        {Array.from({ length: 7 }, (_, index) => (
          <Skeleton key={index} className="h-36 rounded-[var(--radius-card)]" />
        ))}
      </div>
      <Skeleton className="h-14 w-56 rounded-[var(--play-radius)]" />
    </SkeletonGroup>
  );
}
