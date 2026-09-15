"use client";

import { useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { MentorshipStudentReportDto } from "@mentor/types";
import {
  INSET_DIVIDE_CLASS,
  INSET_GROUP_CLASS,
  INSET_ROW_CLASS,
  InsetSection,
  NOTE_CLASS,
  SUBHEAD_CLASS,
} from "@/components/mentorship/coach-ui";

const LIST_CLASS = `${INSET_GROUP_CLASS} ${INSET_DIVIDE_CLASS}`;

/**
 * The living plan, and beside it what the coach's assignments turned into: stuck topics and the
 * tasks the student removed. Kept in one section because they answer one question, "did they do
 * what I gave them", and a separate card would sit empty for most students most of the time.
 */
export function ReportPlan({ report }: { report: MentorshipStudentReportDto }) {
  const t = useTranslations("mentorship");
  const locale = useLocale();
  // `taskDate` is a calendar day; formatting it in UTC keeps it from sliding across midnight.
  const dayFormat = useMemo(
    () => new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", timeZone: "UTC" }),
    [locale],
  );
  const day = (iso: string) => dayFormat.format(new Date(`${iso}T00:00:00.000Z`));
  const topics = summarizeTopics(report.planTasks);
  const dropped = report.droppedAssignments;

  return (
    <InsetSection title={t("report_plan")}>
      {report.planTasks.length === 0 ? (
        <p className={`${INSET_GROUP_CLASS} coach-body px-4 py-3.5 text-[var(--color-secondary)]`}>
          {t("report_plan_empty")}
        </p>
      ) : (
        <ul className={LIST_CLASS}>
          {report.planTasks.map((task, index) => (
            <li key={`${task.taskDate}-${index}`} className={`${INSET_ROW_CLASS} items-start`}>
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="coach-body flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[var(--color-main)]">
                  {task.title}
                  {task.assignedByCoach ? (
                    <span className="coach-caption rounded-md bg-[var(--color-accent-soft)] px-1.5 py-px font-semibold text-[var(--color-accent)]">
                      {t("report_plan_from_you")}
                    </span>
                  ) : null}
                </span>
                <span className="coach-footnote text-[var(--color-secondary)]">
                  {[
                    task.subject ? [task.subject, task.topic].filter(Boolean).join(" › ") : null,
                    day(task.taskDate),
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
                {task.coachNote ? (
                  <span className="coach-footnote text-[var(--color-body)]">{task.coachNote}</span>
                ) : null}
              </div>
              <span
                className={`coach-footnote shrink-0 ${
                  task.status === "DONE"
                    ? "font-semibold text-[var(--color-main)]"
                    : "text-[var(--color-secondary)]"
                }`}
              >
                {t(`task_status_${task.status === "DONE" ? "DONE" : "PENDING"}`)}
              </span>
            </li>
          ))}
        </ul>
      )}

      {topics.length > 0 || dropped.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2">
          {topics.length > 0 ? (
            <div className="flex min-w-0 flex-col gap-2">
              <h3 className={SUBHEAD_CLASS}>{t("report_topic_progress")}</h3>
              <ul className={LIST_CLASS}>
                {topics.map((row) => (
                  <li key={`${row.subject}-${row.topic}`} className={INSET_ROW_CLASS}>
                    <span className="coach-body min-w-0 text-[var(--color-main)]">
                      <span className="text-[var(--color-secondary)]">{row.subject} › </span>
                      {row.topic}
                    </span>
                    <span className="coach-footnote shrink-0 tabular-nums text-[var(--color-secondary)]">
                      {t("report_topic_progress_count", { done: row.done, total: row.total })}
                    </span>
                  </li>
                ))}
              </ul>
              <p className={NOTE_CLASS}>{t("report_topic_progress_body")}</p>
            </div>
          ) : null}

          {dropped.length > 0 ? (
            <div className="flex min-w-0 flex-col gap-2">
              <h3 className={SUBHEAD_CLASS}>{t("report_dropped")}</h3>
              <ul className={LIST_CLASS}>
                {dropped.map((row) => (
                  <li key={`${row.droppedAt}-${row.title}`} className={INSET_ROW_CLASS}>
                    <span className="coach-body min-w-0 text-[var(--color-secondary)]">{row.title}</span>
                    <span className="coach-footnote shrink-0 tabular-nums text-[var(--color-secondary)]">
                      {day(row.taskDate)}
                    </span>
                  </li>
                ))}
              </ul>
              <p className={NOTE_CLASS}>{t("report_dropped_body")}</p>
            </div>
          ) : null}
        </div>
      ) : null}
    </InsetSection>
  );
}

/**
 * Done-vs-total per topic, worst first: "where is this student actually stuck".
 * Only rows that carry a topic take part; an untagged task says nothing about a topic.
 */
function summarizeTopics(
  tasks: MentorshipStudentReportDto["planTasks"],
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
  return [...rows.values()].sort(
    (a, b) => a.done / a.total - b.done / b.total || b.total - a.total,
  );
}
