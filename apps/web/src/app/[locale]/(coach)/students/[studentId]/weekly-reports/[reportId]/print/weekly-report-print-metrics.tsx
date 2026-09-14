"use client";

import { useLocale, useTranslations } from "next-intl";
import type { MentorshipWeeklyReportShareDto } from "@mentor/types";

function ComparisonTable({ rows }: { rows: string[][] }) {
  const t = useTranslations("mentorship");
  return (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr className="border-b border-[var(--color-border)] text-[var(--color-secondary)]">
          <th className="py-2 text-left font-semibold" scope="col" />
          <th className="py-2 text-right font-semibold" scope="col">
            {t("weekly_report_current")}
          </th>
          <th className="py-2 text-right font-semibold" scope="col">
            {t("weekly_report_previous")}
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map(([label, current, previous]) => (
          <tr key={label} className="border-b border-[var(--color-border)]">
            <th
              className="py-2 text-left font-normal text-[var(--color-secondary)]"
              scope="row"
            >
              {label}
            </th>
            <td className="py-2 text-right font-semibold tabular-nums">
              {current}
            </td>
            <td className="py-2 text-right tabular-nums">{previous}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function WeeklyReportPrintMetrics({
  report,
}: {
  report: MentorshipWeeklyReportShareDto;
}) {
  const t = useTranslations("mentorship");
  const locale = useLocale();
  const number = new Intl.NumberFormat(locale);
  const percentFormat = new Intl.NumberFormat(locale, {
    style: "percent",
    maximumFractionDigits: 0,
  });
  const missing = t("weekly_report_missing");
  const net = (value: number | null) =>
    value === null ? missing : number.format(value);
  const percent = (value: number | null) =>
    value === null ? missing : percentFormat.format(value);
  const rows = [
    [
      t("weekly_report_focus"),
      `${number.format(report.snapshot.current.focusMinutes)} ${locale === "tr" ? "dk" : "min"}`,
      `${number.format(report.snapshot.previous.focusMinutes)} ${locale === "tr" ? "dk" : "min"}`,
    ],
    [
      t("weekly_report_sessions"),
      number.format(report.snapshot.current.sessions),
      number.format(report.snapshot.previous.sessions),
    ],
    [
      t("weekly_report_active_days"),
      number.format(report.snapshot.current.activeDays),
      number.format(report.snapshot.previous.activeDays),
    ],
    [
      t("weekly_report_plan"),
      `${report.snapshot.current.completedTasks} / ${report.snapshot.current.plannedTasks}`,
      `${report.snapshot.previous.completedTasks} / ${report.snapshot.previous.plannedTasks}`,
    ],
    [
      t("weekly_report_completion"),
      percent(report.snapshot.current.completionRate),
      percent(report.snapshot.previous.completionRate),
    ],
  ];
  const mockRows = [
    [
      t("weekly_report_mock_attempts"),
      String(report.snapshot.mocks.currentAttemptCount),
      String(report.snapshot.mocks.previousAttemptCount),
    ],
    [
      t("weekly_report_mock_average"),
      net(report.snapshot.mocks.currentAverageNet),
      net(report.snapshot.mocks.previousAverageNet),
    ],
    ...report.snapshot.mocks.subjects.map((subject) => [
      subject.subjectRef,
      net(subject.currentAverageNet),
      net(subject.previousAverageNet),
    ]),
  ];

  return (
    <div className="flex flex-col gap-6">
      <ComparisonTable rows={rows} />
      <section className="break-inside-avoid">
        <h2 className="mb-2 text-base font-bold">
          {t("weekly_report_subjects")}
        </h2>
        {report.snapshot.subjects.length === 0 ? (
          <p className="text-sm text-[var(--color-secondary)]">
            {t("weekly_report_no_subjects")}
          </p>
        ) : (
          <table className="w-full border-collapse text-sm">
            <tbody>
              {report.snapshot.subjects.map((subject) => (
                <tr
                  key={subject.subjectRef ?? "unclassified"}
                  className="border-b border-[var(--color-border)]"
                >
                  <th className="py-2 text-left font-normal" scope="row">
                    {subject.subjectRef ?? t("weekly_report_unclassified")}
                  </th>
                  <td className="py-2 text-right tabular-nums">
                    {t("weekly_report_subject_comparison", {
                      current: t("weekly_report_subject_measure", {
                        minutes: subject.currentFocusMinutes,
                        sessions: subject.currentSessions,
                      }),
                      previous: t("weekly_report_subject_measure", {
                        minutes: subject.previousFocusMinutes,
                        sessions: subject.previousSessions,
                      }),
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
      <section className="break-inside-avoid">
        <h2 className="mb-2 text-base font-bold">{t("weekly_report_mocks")}</h2>
        {report.snapshot.mocks.examScopeName ? (
          <p className="mb-2 text-xs text-[var(--color-secondary)]">
            {t("weekly_report_mock_scope", {
              exam: report.snapshot.mocks.examScopeName,
            })}
          </p>
        ) : null}
        <ComparisonTable rows={mockRows} />
        <div className="mt-2 grid gap-1 text-xs text-[var(--color-secondary)] sm:grid-cols-2">
          <p>
            {t("weekly_report_publishers_current", {
              publishers:
                report.snapshot.mocks.currentPublishers.length > 0
                  ? report.snapshot.mocks.currentPublishers.join(", ")
                  : t("weekly_report_no_publishers"),
            })}
          </p>
          <p>
            {t("weekly_report_publishers_previous", {
              publishers:
                report.snapshot.mocks.previousPublishers.length > 0
                  ? report.snapshot.mocks.previousPublishers.join(", ")
                  : t("weekly_report_no_publishers"),
            })}
          </p>
        </div>
        <p className="mt-2 text-xs text-[var(--color-secondary)]">
          {t("weekly_report_mock_caveat")}
        </p>
      </section>
      {report.snapshot.limitations.length > 0 ? (
        <ul className="break-inside-avoid space-y-1 text-xs text-[var(--color-secondary)]">
          {report.snapshot.limitations.map((limitation) => (
            <li key={limitation}>
              {t(`weekly_report_limitation_${limitation}`)}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
