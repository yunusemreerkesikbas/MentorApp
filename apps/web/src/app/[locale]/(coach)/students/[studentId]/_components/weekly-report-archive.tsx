"use client";

import { useLocale, useTranslations } from "next-intl";
import type { MentorshipWeeklyReportListItemDto } from "@mentor/types";
import { Link } from "@/i18n/navigation";
import {
  INSET_DIVIDE_CLASS,
  INSET_GROUP_CLASS,
  INSET_ROW_CLASS,
  NOTE_CLASS,
} from "@/components/mentorship/coach-ui";

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
  const locale = useLocale();
  const format = new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return (
    <section
      className="flex flex-col gap-2"
      aria-labelledby={showTitle ? "weekly-archive-title" : undefined}
      aria-label={showTitle ? undefined : t("weekly_report_archive")}
    >
      {showTitle ? (
        <h3
          id="weekly-archive-title"
          className="coach-headline px-1 text-[var(--color-main)]"
        >
          {t("weekly_report_archive")}
        </h3>
      ) : null}
      {items.length === 0 ? (
        <p className={NOTE_CLASS}>{t("weekly_report_archive_empty")}</p>
      ) : (
        <div
          className={`${INSET_GROUP_CLASS} ${INSET_DIVIDE_CLASS}`}
        >
          {items.map((item) => (
            <div key={item.id} className={INSET_ROW_CLASS}>
              <div>
                <p className="coach-body font-semibold text-[var(--color-main)]">
                  {format.format(
                    new Date(`${item.period.startDate}T12:00:00.000Z`),
                  )}
                </p>
                <p className="coach-footnote text-[var(--color-secondary)]">
                  {t("weekly_report_version", { version: item.version })}
                </p>
              </div>
              <Link
                locale={item.locale}
                className="coach-footnote min-h-11 content-center font-semibold text-[var(--color-primary)]"
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
