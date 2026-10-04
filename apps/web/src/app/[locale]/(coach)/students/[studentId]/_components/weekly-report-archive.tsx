"use client";

import { useTranslations } from "next-intl";
import type { MentorshipWeeklyReportListItemDto } from "@mentor/types";
import { PANEL_TEXT_LINK } from "@/components/panel/panel-styles";
import { Link } from "@/i18n/navigation";
import {
  INSET_DIVIDE_CLASS,
  INSET_GROUP_CLASS,
  INSET_ROW_CLASS,
  NOTE_CLASS,
} from "@/components/mentorship/coach-ui";
import { useReportDates } from "./use-report-dates";

export function WeeklyReportArchive({
  studentId,
  items,
  showTitle = true,
}: {
  studentId: string;
  items: MentorshipWeeklyReportListItemDto[];
  showTitle?: boolean;
}) {
  const t = useTranslations("mentorship");
  const dates = useReportDates();

  return (
    <section
      className="flex flex-col gap-2"
      aria-labelledby={showTitle ? "weekly-archive-title" : undefined}
      aria-label={showTitle ? undefined : t("weekly_report_archive")}
    >
      {showTitle ? (
        <h3
          id="weekly-archive-title"
          className="px-1 text-base font-extrabold text-[var(--color-main)]"
        >
          {t("weekly_report_archive")}
        </h3>
      ) : null}
      {items.length === 0 ? (
        <p className={NOTE_CLASS}>{t("weekly_report_archive_empty")}</p>
      ) : (
        <div className={`${INSET_GROUP_CLASS} ${INSET_DIVIDE_CLASS}`}>
          {items.map((item) => (
            <div key={item.id} className={INSET_ROW_CLASS}>
              <div>
                <p className="text-body-sm font-extrabold text-[var(--color-main)]">
                  {dates.range(item.period.startDate, item.period.endDate)}
                </p>
                <p className="text-caption text-[var(--color-secondary)]">
                  {t("weekly_report_version", { version: item.version })}
                </p>
              </div>
              <Link
                locale={item.locale}
                className={PANEL_TEXT_LINK}
                href={{
                  pathname:
                    "/students/[studentId]/weekly-reports/[reportId]/print",
                  params: { studentId, reportId: item.id },
                }}
              >
                {t("weekly_report_open_print")}
              </Link>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
