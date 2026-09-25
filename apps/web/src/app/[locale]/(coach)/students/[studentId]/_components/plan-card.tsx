"use client";

import { useMemo } from "react";
import { BookOpen, Check, GraduationCap } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import type { MentorshipReportPlanTaskDto, MentorshipStudentReportDto } from "@mentor/types";
import { PANEL_CARD, PANEL_CARD_TITLE } from "@/components/panel/panel-styles";
import { ProgressLine } from "@/components/panel/progress-line";
import { groupPlanTasks } from "./week-filmstrip-model";

const SUBHEAD = "text-caption font-extrabold text-[var(--color-secondary)]";

/**
 * The living plan grouped by week, the coach's own tasks marked with the coach's cap, and below it
 * what those tasks turned into: where a topic is stuck, and what the student took out of the plan.
 */
export function PlanCard({
  report,
  today,
}: {
  report: MentorshipStudentReportDto;
  /** Europe/Istanbul `yyyy-mm-dd`. */
  today: string;
}) {
  const t = useTranslations("mentorship");
  const format = useFormatter();
  const groups = useMemo(() => groupPlanTasks(report.planTasks, today), [report.planTasks, today]);
  const topics = useMemo(() => summarizeTopics(report.planTasks), [report.planTasks]);
  const dropped = report.droppedAssignments;
  const day = (iso: string) => {
    const date = new Date(`${iso}T00:00:00.000Z`);
    return `${format.dateTime(date, { weekday: "short", timeZone: "UTC" })} ${date.getUTCDate()}`;
  };

  return (
    <section className={`${PANEL_CARD} flex flex-col gap-1`} aria-labelledby="plan-title">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="plan-title" className={PANEL_CARD_TITLE}>
          {t("report_plan")}
        </h2>
        {groups.length > 0 ? (
          <span className="text-caption font-bold text-[var(--color-secondary)]">{t("plan_window")}</span>
        ) : null}
      </div>

      {groups.length === 0 ? (
        <p className="mt-2 text-body-sm font-semibold text-[var(--color-body)]">{t("report_plan_empty")}</p>
      ) : (
        groups.map((group) => (
          <div key={group.key} className="mt-3 flex flex-col">
            <h3 className={SUBHEAD}>{t(`plan_group_${group.key}`)}</h3>
            <ul className="mt-1 flex flex-col">
              {group.tasks.map((task, index) => (
                <PlanRow key={`${task.taskDate}-${index}`} task={task} day={day(task.taskDate)} />
              ))}
            </ul>
          </div>
        ))
      )}

      {topics.length > 0 || dropped.length > 0 ? (
        <div className="mt-4 grid gap-6 sm:grid-cols-2">
          {topics.length > 0 ? (
            <div className="flex min-w-0 flex-col gap-3">
              <h3 className={SUBHEAD}>{t("report_topic_progress")}</h3>
              {topics.map((row) => {
                const label = `${row.subject} › ${row.topic}`;
                return (
                  <div key={label} className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between gap-3">
                      <span className="min-w-0 text-sm font-extrabold text-[var(--color-main)]">{label}</span>
                      <span className="shrink-0 text-caption font-extrabold tabular-nums text-[var(--color-secondary)]">
                        {row.done}/{row.total}
                      </span>
                    </div>
                    <ProgressLine
                      label={t("plan_topic_aria", { topic: label, done: row.done, total: row.total })}
                      value={row.done}
                      max={row.total}
                      complete={row.done === row.total}
                    />
                  </div>
                );
              })}
            </div>
          ) : null}
          {dropped.length > 0 ? (
            <div className="flex min-w-0 flex-col gap-2">
              <h3 className={SUBHEAD}>{t("report_dropped")}</h3>
              <ul className="flex flex-col gap-1">
                {dropped.map((row) => (
                  <li key={`${row.droppedAt}-${row.title}`} className="text-sm font-bold text-[var(--color-body)]">
                    {row.title} · {day(row.taskDate)}
                  </li>
                ))}
              </ul>
              <p className="text-caption font-semibold text-[var(--color-secondary)]">{t("report_dropped_body")}</p>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function PlanRow({ task, day }: { task: MentorshipReportPlanTaskDto; day: string }) {
  const t = useTranslations("mentorship");
  const done = task.status === "DONE";
  const meta = [task.subject ? [task.subject, task.topic].filter(Boolean).join(" › ") : null, day]
    .filter(Boolean)
    .join(" · ");

  return (
    <li className="flex items-start gap-3 border-t border-[var(--play-line)] py-3 first:border-t-0">
      {task.assignedByCoach ? (
        <span
          role="img"
          aria-label={t("plan_mark_coach")}
          className="grid size-7 shrink-0 place-items-center rounded-full bg-[var(--coach-accent)] text-[var(--color-bg)]"
        >
          <GraduationCap className="size-4" aria-hidden />
        </span>
      ) : (
        <span
          role="img"
          aria-label={t("plan_mark_own")}
          className="grid size-7 shrink-0 place-items-center rounded-full bg-[var(--color-surface-container)] text-[var(--color-secondary)]"
        >
          <BookOpen className="size-4" aria-hidden />
        </span>
      )}
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-body-sm font-extrabold leading-snug text-[var(--color-main)]">{task.title}</span>
        <span className="text-caption font-semibold text-[var(--color-secondary)]">{meta}</span>
        {task.coachNote ? (
          <p className="mt-1.5 rounded-[var(--radius-card)] bg-[var(--coach-accent-soft)] px-3 py-2 text-caption font-bold text-[var(--coach-accent-ink)]">
            {task.coachNote}
          </p>
        ) : null}
      </div>
      {done ? (
        <span className="inline-flex shrink-0 items-center gap-1 text-caption font-extrabold text-[var(--color-success)]">
          <Check className="size-4" strokeWidth={3} aria-hidden />
          {t("task_status_DONE")}
        </span>
      ) : (
        <span className="shrink-0 text-caption font-bold text-[var(--color-secondary)]">{t("task_status_PENDING")}</span>
      )}
    </li>
  );
}

/**
 * Done-vs-total per topic, worst first: "where is this student actually stuck". Only rows that carry
 * a topic take part; an untagged task says nothing about a topic.
 */
function summarizeTopics(
  tasks: readonly MentorshipReportPlanTaskDto[],
): { subject: string; topic: string; done: number; total: number }[] {
  const rows = new Map<string, { subject: string; topic: string; done: number; total: number }>();
  for (const task of tasks) {
    if (!task.topic || !task.subject) continue;
    const key = `${task.subject} ${task.topic}`;
    const row = rows.get(key) ?? { subject: task.subject, topic: task.topic, done: 0, total: 0 };
    row.total += 1;
    if (task.status === "DONE") row.done += 1;
    rows.set(key, row);
  }
  return [...rows.values()].sort((a, b) => a.done / a.total - b.done / b.total || b.total - a.total);
}
