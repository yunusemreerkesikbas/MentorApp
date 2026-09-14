"use client";

import { useLocale, useTranslations } from "next-intl";
import type { MentorshipWeeklyReportListItemDto } from "@mentor/types";
import { Link } from "@/i18n/navigation";
import {
  INSET_GROUP_CLASS,
  INSET_ROW_CLASS,
  NOTE_CLASS,
} from "@/components/mentorship/coach-ui";

export function WeeklyReportArchive({
  studentId,
  items,
}: {
  studentId: string;
  items: MentorshipWeeklyReportListItemDto[];
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
      aria-labelledby="weekly-archive-title"
    >
      <h3
        id="weekly-archive-title"
        className="coach-headline px-1 text-[var(--color-main)]"
      >
        {t("weekly_report_archive")}
      </h3>
      {items.length === 0 ? (
        <p className={NOTE_CLASS}>{t("weekly_report_archive_empty")}</p>
      ) : (
        <div
          className={`${INSET_GROUP_CLASS} divide-y divide-[var(--color-border)]`}
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
