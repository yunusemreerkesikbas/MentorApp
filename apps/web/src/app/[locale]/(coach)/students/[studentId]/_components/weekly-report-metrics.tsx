"use client";

import type { ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import type {
  MentorshipWeeklySnapshotDto,
  MentorshipWeeklySubjectNamesDto,
} from "@mentor/types";
import { NOTE_CLASS } from "@/components/mentorship/coach-ui";
import { durationLabel } from "./report-format";
import { useReportDates } from "./use-report-dates";

/**
 * The week against the week before, as the canvas draws it: three plain tables whose columns are
 * the two weeks' dates. The panel keeps what a coach talks about; sessions, plan percentages,
 * per-subject nets and publishers stay in the print and the PDF, which carry everything.
 */
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
  const dates = useReportDates();
  const number = new Intl.NumberFormat(locale);
  const net = (value: number | null) =>
    value === null ? t("weekly_report_missing") : number.format(value);
  const { period } = snapshot;
  const columns = [
    dates.rangeShort(period.startDate, period.endDate),
    dates.rangeShort(period.previousStartDate, period.previousEndDate),
  ] as const;
  const mocks = snapshot.mocks;
  const anyMock = mocks.currentAttemptCount > 0 || mocks.previousAttemptCount > 0;

  return (
    <div className="flex flex-col gap-5">
      <CompareTable
        head={t("weekly_panel_summary")}
        columns={columns}
        rows={[
          [
            t("weekly_report_focus"),
            durationLabel(t, snapshot.current.focusMinutes),
            durationLabel(t, snapshot.previous.focusMinutes),
          ],
          [
            t("weekly_report_active_days"),
            number.format(snapshot.current.activeDays),
            number.format(snapshot.previous.activeDays),
          ],
          [
            t("weekly_panel_tasks_done"),
            `${snapshot.current.completedTasks}/${snapshot.current.plannedTasks}`,
            `${snapshot.previous.completedTasks}/${snapshot.previous.plannedTasks}`,
          ],
        ]}
      />

      {snapshot.subjects.length === 0 ? (
        <p className={NOTE_CLASS}>{t("weekly_report_no_subjects")}</p>
      ) : (
        <CompareTable
          head={t("weekly_panel_subjects")}
          columns={columns}
          rows={snapshot.subjects.map((row) => [
            row.subjectRef ? (subjectNames[row.subjectRef] ?? row.subjectRef) : t("weekly_report_unclassified"),
            t("value_minutes", { count: row.currentFocusMinutes }),
            t("value_minutes", { count: row.previousFocusMinutes }),
          ])}
        />
      )}

      {anyMock ? (
        <div className="flex flex-col gap-1">
          <CompareTable
            head={
              mocks.examScopeName
                ? t("weekly_panel_mocks", { exam: mocks.examScopeName })
                : t("weekly_panel_mocks_plain")
            }
            columns={columns}
            rows={[[t("weekly_report_mock_average"), net(mocks.currentAverageNet), net(mocks.previousAverageNet)]]}
          />
          <p className={NOTE_CLASS}>
            {t("weekly_panel_mock_counts", {
              current: mocks.currentAttemptCount,
              previous: mocks.previousAttemptCount,
            })}{" "}
            {t("weekly_report_mock_caveat")}
          </p>
        </div>
      ) : (
        <p className={NOTE_CLASS}>{t("weekly_panel_no_mocks")}</p>
      )}

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

/** One canvas table: a row head, then this week and the week before. */
function CompareTable({
  head,
  columns,
  rows,
}: {
  head: string;
  columns: readonly [string, string];
  rows: readonly (readonly [ReactNode, ReactNode, ReactNode])[];
}) {
  return (
    <div className="overflow-x-auto">
      {/* Fixed columns: the three tables line their weeks up under one another. */}
      <table className="w-full table-fixed border-collapse text-left">
        <colgroup>
          <col />
          <col className="w-24 sm:w-28" />
          <col className="w-24 sm:w-28" />
        </colgroup>
        <thead>
          <tr className="text-caption font-extrabold text-[var(--color-secondary)]">
            <th scope="col" className="py-2 pr-3 font-extrabold">
              {head}
            </th>
            <th scope="col" className="whitespace-nowrap py-2 pl-3 text-right font-extrabold">
              {columns[0]}
            </th>
            <th scope="col" className="whitespace-nowrap py-2 pl-3 text-right font-extrabold">
              {columns[1]}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([label, current, previous], index) => (
            <tr key={index} className="border-t border-[var(--play-line)]">
              <th scope="row" className="py-2.5 pr-3 text-body-sm font-semibold text-[var(--color-body)]">
                {label}
              </th>
              <td className="whitespace-nowrap py-2.5 pl-3 text-right text-body-sm font-bold tabular-nums text-[var(--color-main)]">
                {current}
              </td>
              <td className="whitespace-nowrap py-2.5 pl-3 text-right text-body-sm font-bold tabular-nums text-[var(--color-main)]">
                {previous}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
