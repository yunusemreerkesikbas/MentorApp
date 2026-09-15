"use client";

import { useLocale, useTranslations } from "next-intl";
import type { MentorshipStudentReportDto } from "@mentor/types";
import {
  INSET_DIVIDE_CLASS,
  INSET_GROUP_CLASS,
  INSET_ROW_CLASS,
  InsetSection,
} from "@/components/mentorship/coach-ui";
import { formatRate, relativeDay } from "../../../_components/mentorship-format";

/**
 * The activity numbers as a settings-style list: label left, value right, two columns of three.
 * Sessions and active days share a row so the columns stay even instead of ending on a blank cell.
 */
export function ReportActivity({ report }: { report: MentorshipStudentReportDto }) {
  const t = useTranslations("mentorship");
  const locale = useLocale();
  const { activity } = report;

  const last = relativeDay(activity.lastActiveDate);
  const lastLabel =
    last.kind === "never"
      ? t("value_never")
      : last.kind === "today"
        ? t("value_today")
        : last.kind === "yesterday"
          ? t("value_yesterday")
          : t("value_days_ago", { count: last.days });

  const columns: [label: string, value: string][][] = [
    [
      [t("metric_last_active"), lastLabel],
      [
        t("metric_streak"),
        t("value_streak_longest", {
          current: activity.currentStreak,
          longest: activity.longestStreak,
        }),
      ],
      [
        t("metric_plan_completion"),
        formatRate(report.planCompletionRate7d, locale) ?? t("value_none"),
      ],
    ],
    [
      [t("metric_focus_7d"), t("value_minutes", { count: activity.focusMinutes7d })],
      [t("metric_focus_28d"), t("value_minutes", { count: activity.focusMinutes28d })],
      [t("metric_sessions_active_days"), `${activity.sessions7d} · ${activity.activeDays7d}/7`],
    ],
  ];

  return (
    <InsetSection title={t("report_activity")}>
      <div className={`${INSET_GROUP_CLASS} grid sm:grid-cols-2`}>
        {columns.map((rows, column) => (
          <dl
            key={column}
            className={`${INSET_DIVIDE_CLASS} ${
              column === 1 ? "border-t border-[var(--color-surface-container)] sm:border-l sm:border-t-0" : ""
            }`}
          >
            {rows.map(([label, value]) => (
              <div key={label} className={INSET_ROW_CLASS}>
                <dt className="coach-body text-[var(--color-secondary)]">{label}</dt>
                <dd className="coach-body text-right font-semibold tabular-nums text-[var(--color-main)]">
                  {value}
                </dd>
              </div>
            ))}
          </dl>
        ))}
      </div>
    </InsetSection>
  );
}
