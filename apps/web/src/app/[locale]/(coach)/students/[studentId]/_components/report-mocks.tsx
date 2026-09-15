"use client";

import { useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { MentorshipStudentReportDto } from "@mentor/types";
import {
  INSET_DIVIDE_CLASS,
  INSET_GROUP_CLASS,
  INSET_ROW_CLASS,
  InsetSection,
} from "@/components/mentorship/coach-ui";
import { formatNet } from "../../../_components/mentorship-format";

type Mock = MentorshipStudentReportDto["mockTrend"][number];

const CHART_WIDTH = 248;
const CHART_HEIGHT = 72;
const PLOT_TOP = 10;
const PLOT_BOTTOM = 60;
const PLOT_INSET = 8;
/** A two-net wobble must not draw like a cliff, so the scale never spans fewer nets than this. */
const MIN_NET_SPAN = 10;

/**
 * Mock nets as a list (the exact numbers, and the chart's table view) next to a small trend line.
 * The line is neutral on purpose: a falling net is shown, never painted as bad news.
 */
export function ReportMocks({ report }: { report: MentorshipStudentReportDto }) {
  const t = useTranslations("mentorship");
  const locale = useLocale();
  const dayFormat = useMemo(
    () => new Intl.DateTimeFormat(locale, { day: "numeric", month: "long" }),
    [locale],
  );
  const mocks = report.mockTrend;
  const subjects = report.latestMockSubjects;

  if (mocks.length === 0) {
    return (
      <InsetSection title={t("report_mocks")}>
        <p className={`${INSET_GROUP_CLASS} coach-body px-4 py-3.5 text-[var(--color-secondary)]`}>
          {t("report_mock_empty")}
        </p>
      </InsetSection>
    );
  }

  return (
    <InsetSection title={t("report_mocks")}>
      <div className={`${INSET_GROUP_CLASS} ${INSET_DIVIDE_CLASS}`}>
        <div className="grid md:grid-cols-[minmax(0,1fr)_17.5rem]">
          <ul className={INSET_DIVIDE_CLASS}>
            {mocks.map((mock, index) => (
              <li key={mock.takenAt} className={INSET_ROW_CLASS}>
                <span className="coach-body min-w-0 text-[var(--color-secondary)]">
                  {dayFormat.format(new Date(mock.takenAt))}
                  {mock.publisherName ? ` · ${mock.publisherName}` : ""}
                </span>
                <span
                  className={`coach-body shrink-0 tabular-nums text-[var(--color-main)] ${
                    index === 0 ? "font-semibold" : ""
                  }`}
                >
                  {formatNet(mock.totalNet, locale)}
                </span>
              </li>
            ))}
          </ul>
          {mocks.length > 1 ? (
            <MockTrend
              mocks={mocks}
              label={t("report_mocks_trend_label", { count: mocks.length })}
              pointLabel={(mock) => `${dayFormat.format(new Date(mock.takenAt))}: ${formatNet(mock.totalNet, locale)}`}
            />
          ) : null}
        </div>

        {subjects.length > 0 ? (
          <div className="px-4 pb-2 pt-3">
            <h3 className="coach-footnote font-semibold text-[var(--color-secondary)]">
              {t("report_latest_mock_subjects")}
            </h3>
            {/* Wide content scrolls inside its own box; the page never scrolls sideways. */}
            <div className="overflow-x-auto">
              {/* 18rem fits a 375px phone inside the group, so the net column is not the one that
                  scrolls out of view. */}
              <table className="coach-body w-full min-w-72 tabular-nums">
                <thead>
                  <tr className="coach-footnote text-[var(--color-secondary)]">
                    <th className="py-2 text-left font-medium">{t("report_subject_table_subject")}</th>
                    <th className="py-2 text-right font-medium">{t("report_subject_table_correct")}</th>
                    <th className="py-2 text-right font-medium">{t("report_subject_table_wrong")}</th>
                    <th className="py-2 text-right font-medium">{t("report_subject_table_blank")}</th>
                    <th className="py-2 text-right font-medium">{t("report_subject_table_net")}</th>
                  </tr>
                </thead>
                <tbody className={`${INSET_DIVIDE_CLASS} text-[var(--color-main)]`}>
                  {subjects.map((subject) => (
                    <tr key={subject.subjectRef}>
                      <td className="py-2">{subject.subjectRef}</td>
                      <td className="py-2 text-right">{subject.correct}</td>
                      <td className="py-2 text-right">{subject.wrong}</td>
                      <td className="py-2 text-right">{subject.blank}</td>
                      <td className="py-2 text-right font-semibold">{formatNet(subject.net, locale)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </div>
    </InsetSection>
  );
}

function MockTrend({
  mocks,
  label,
  pointLabel,
}: {
  mocks: readonly Mock[];
  label: string;
  pointLabel: (mock: Mock) => string;
}) {
  // The API sends newest first; a line reads left to right in time.
  const series = [...mocks].reverse();
  const nets = series.map((mock) => mock.totalNet);
  const middle = (Math.max(...nets) + Math.min(...nets)) / 2;
  const span = Math.max(Math.max(...nets) - Math.min(...nets), MIN_NET_SPAN) * 1.5;
  const low = middle - span / 2;
  const step = (CHART_WIDTH - PLOT_INSET * 2) / (series.length - 1);
  const points = series.map((mock, index) => ({
    mock,
    x: PLOT_INSET + index * step,
    y: PLOT_BOTTOM - ((mock.totalNet - low) / span) * (PLOT_BOTTOM - PLOT_TOP),
  }));
  const last = points[points.length - 1]!;

  return (
    <div className="flex flex-col gap-2 border-t border-[var(--color-border)] px-4 py-3.5 md:border-l md:border-t-0">
      <span className="coach-footnote text-[var(--color-secondary)]">{label}</span>
      <svg
        role="img"
        aria-label={label}
        width={CHART_WIDTH}
        height={CHART_HEIGHT}
        viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
        className="max-w-full"
      >
        <line
          x1="0"
          y1={CHART_HEIGHT - 1}
          x2={CHART_WIDTH}
          y2={CHART_HEIGHT - 1}
          stroke="var(--color-border)"
          strokeWidth="1"
        />
        <polyline
          points={points.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" ")}
          fill="none"
          stroke="var(--color-secondary)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx={last.x} cy={last.y} r="4" fill="var(--color-main)" stroke="var(--color-surface)" strokeWidth="2" />
        {/* Hit targets larger than the marks, each with its value as a native tooltip. */}
        {points.map((point) => (
          <circle key={point.mock.takenAt} cx={point.x} cy={point.y} r="10" fill="transparent">
            <title>{pointLabel(point.mock)}</title>
          </circle>
        ))}
      </svg>
    </div>
  );
}
