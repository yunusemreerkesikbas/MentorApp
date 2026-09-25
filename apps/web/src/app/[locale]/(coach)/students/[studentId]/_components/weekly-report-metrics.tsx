"use client";

import { useLocale, useTranslations } from "next-intl";
import type {
  MentorshipWeeklySnapshotDto,
  MentorshipWeeklySubjectNamesDto,
} from "@mentor/types";
import {
  INSET_DIVIDE_CLASS,
  INSET_GROUP_CLASS,
  INSET_ROW_CLASS,
  NOTE_CLASS,
  SUBHEAD_CLASS,
} from "@/components/mentorship/coach-ui";

export function WeeklyReportMetrics({
  snapshot,
  subjectNames,
}: {
  snapshot: MentorshipWeeklySnapshotDto;
  /** Names beside the snapshot (never inside it: the fingerprint hashes the snapshot). */
  subjectNames: MentorshipWeeklySubjectNamesDto;
}) {
  const t = useTranslations("mentorship");
  const locale = useLocale();
  const number = new Intl.NumberFormat(locale);
  const subject = (ref: string) => subjectNames[ref] ?? ref;
  const percent = (value: number | null) =>
    value === null ? t("weekly_report_missing") : `%${Math.round(value * 100)}`;
  const net = (value: number | null) =>
    value === null ? t("weekly_report_missing") : number.format(value);
  const rows = [
    {
      label: t("weekly_report_focus"),
      current: t("value_minutes", { count: snapshot.current.focusMinutes }),
      previous: t("value_minutes", { count: snapshot.previous.focusMinutes }),
    },
    {
      label: t("weekly_report_sessions"),
      current: number.format(snapshot.current.sessions),
      previous: number.format(snapshot.previous.sessions),
    },
    {
      label: t("weekly_report_active_days"),
      current: number.format(snapshot.current.activeDays),
      previous: number.format(snapshot.previous.activeDays),
    },
    {
      label: t("weekly_report_plan"),
      current: `${snapshot.current.completedTasks} / ${snapshot.current.plannedTasks}`,
      previous: `${snapshot.previous.completedTasks} / ${snapshot.previous.plannedTasks}`,
    },
    {
      label: t("weekly_report_completion"),
      current: percent(snapshot.current.completionRate),
      previous: percent(snapshot.previous.completionRate),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className={`${INSET_GROUP_CLASS} overflow-x-auto`}>
        <table className="w-full min-w-max border-collapse text-left">
          <thead className="text-caption text-[var(--color-secondary)]">
            <tr>
              <th className="px-4 py-3 font-extrabold" scope="col" />
              <th className="px-4 py-3 text-right font-extrabold" scope="col">
                {t("weekly_report_current")}
              </th>
              <th className="px-4 py-3 text-right font-extrabold" scope="col">
                {t("weekly_report_previous")}
              </th>
            </tr>
          </thead>
          <tbody className={INSET_DIVIDE_CLASS}>
            {rows.map((row) => (
              <tr key={row.label}>
                <th
                  className="px-4 py-3 text-body-sm font-semibold text-[var(--color-secondary)]"
                  scope="row"
                >
                  {row.label}
                </th>
                <td className="px-4 py-3 text-right text-body-sm font-extrabold tabular-nums text-[var(--color-main)]">
                  {row.current}
                </td>
                <td className="px-4 py-3 text-right text-body-sm font-semibold tabular-nums text-[var(--color-secondary)]">
                  {row.previous}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h3 className={SUBHEAD_CLASS}>{t("weekly_report_subjects")}</h3>
      {snapshot.subjects.length === 0 ? (
        <p className={NOTE_CLASS}>{t("weekly_report_no_subjects")}</p>
      ) : (
        <div className={`${INSET_GROUP_CLASS} ${INSET_DIVIDE_CLASS}`}>
          {snapshot.subjects.map((row) => (
            <div key={row.subjectRef ?? "unclassified"} className={INSET_ROW_CLASS}>
              <span className="text-body-sm font-bold text-[var(--color-main)]">
                {row.subjectRef ? subject(row.subjectRef) : t("weekly_report_unclassified")}
              </span>
              <span className="text-right text-caption font-semibold tabular-nums text-[var(--color-secondary)]">
                {t("weekly_report_subject_comparison", {
                  current: t("weekly_report_subject_measure", {
                    minutes: row.currentFocusMinutes,
                    sessions: row.currentSessions,
                  }),
                  previous: t("weekly_report_subject_measure", {
                    minutes: row.previousFocusMinutes,
                    sessions: row.previousSessions,
                  }),
                })}
              </span>
            </div>
          ))}
        </div>
      )}

      <h3 className={SUBHEAD_CLASS}>{t("weekly_report_mocks")}</h3>
      {snapshot.mocks.examScopeName ? (
        <p className={NOTE_CLASS}>
          {t("weekly_report_mock_scope", {
            exam: snapshot.mocks.examScopeName,
          })}
        </p>
      ) : null}
      <div className={`${INSET_GROUP_CLASS} ${INSET_DIVIDE_CLASS}`}>
        <div className={INSET_ROW_CLASS}>
          <span className="text-body-sm font-semibold text-[var(--color-secondary)]">
            {t("weekly_report_mock_attempts")}
          </span>
          <span className="text-body-sm font-extrabold tabular-nums text-[var(--color-main)]">
            {snapshot.mocks.currentAttemptCount} /{" "}
            {snapshot.mocks.previousAttemptCount}
          </span>
        </div>
        <div className={INSET_ROW_CLASS}>
          <span className="text-body-sm font-semibold text-[var(--color-secondary)]">
            {t("weekly_report_mock_average")}
          </span>
          <span className="text-body-sm font-extrabold tabular-nums text-[var(--color-main)]">
            {net(snapshot.mocks.currentAverageNet)} /{" "}
            {net(snapshot.mocks.previousAverageNet)}
          </span>
        </div>
        {snapshot.mocks.subjects.map((row) => (
          <div key={row.subjectRef} className={INSET_ROW_CLASS}>
            <span className="text-body-sm font-semibold text-[var(--color-secondary)]">
              {subject(row.subjectRef)}
            </span>
            <span className="text-caption font-bold tabular-nums text-[var(--color-main)]">
              {net(row.currentAverageNet)} / {net(row.previousAverageNet)}
            </span>
          </div>
        ))}
      </div>
      <div className="grid gap-1 px-1 sm:grid-cols-2">
        <p className={NOTE_CLASS}>
          {t("weekly_report_publishers_current", {
            publishers:
              snapshot.mocks.currentPublishers.length > 0
                ? snapshot.mocks.currentPublishers.join(", ")
                : t("weekly_report_no_publishers"),
          })}
        </p>
        <p className={NOTE_CLASS}>
          {t("weekly_report_publishers_previous", {
            publishers:
              snapshot.mocks.previousPublishers.length > 0
                ? snapshot.mocks.previousPublishers.join(", ")
                : t("weekly_report_no_publishers"),
          })}
        </p>
      </div>
      <p className={NOTE_CLASS}>{t("weekly_report_mock_caveat")}</p>

      {snapshot.limitations.length > 0 ? (
        <ul className="flex flex-col gap-1 px-1">
          {snapshot.limitations.map((limitation) => (
            <li key={limitation} className="text-caption text-[var(--color-secondary)]">
              {t(`weekly_report_limitation_${limitation}`)}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
