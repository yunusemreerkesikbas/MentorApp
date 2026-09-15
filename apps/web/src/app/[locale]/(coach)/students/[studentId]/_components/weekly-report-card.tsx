"use client";

import { useState } from "react";
import { AnimatePresence } from "framer-motion";
import { BarChart3, ChevronRight } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Button, Skeleton, SkeletonGroup } from "@mentor/ui";
import { InsetSection, NOTE_CLASS } from "@/components/mentorship/coach-ui";
import { useWeeklyReportCard } from "./use-weekly-report-card";
import { WeeklyReportPanel } from "./weekly-report-panel";

export function WeeklyReportCard({ studentId }: { studentId: string }) {
  const t = useTranslations("mentorship");
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const report = useWeeklyReportCard(studentId);

  if (report.state === "disabled") return null;
  if (report.state === "loading") {
    return (
      <SkeletonGroup label={t("weekly_report_loading")} className="flex flex-col gap-3">
        <Skeleton className="h-8 w-56 rounded-[var(--radius-card)]" />
        <Skeleton className="h-32 w-full rounded-[var(--radius-card)]" />
      </SkeletonGroup>
    );
  }
  if (report.state === "failed" || !report.preview) {
    return (
      <InsetSection title={t("weekly_report_title")}>
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-card)] bg-[var(--color-surface)] p-4">
          <p className={NOTE_CLASS}>{t("weekly_report_load_failed")}</p>
          <Button type="button" variant="secondary" size="sm" onClick={() => void report.retry()}>
            {t("weekly_report_retry")}
          </Button>
        </div>
      </InsetSection>
    );
  }

  const preview = report.preview;
  const number = new Intl.NumberFormat(locale);
  const dateFormat = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric" });
  const formatDate = (value: string) => dateFormat.format(new Date(`${value}T12:00:00.000Z`));
  const period = t("weekly_report_period", {
    start: formatDate(preview.snapshot.period.startDate),
    end: formatDate(preview.snapshot.period.endDate),
  });
  const mockAverage = preview.snapshot.mocks.currentAverageNet;

  return (
    <>
      <InsetSection title={t("weekly_report_title")}>
        <div className="rounded-[var(--radius-card)] bg-[var(--color-surface)] p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-start gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-[var(--radius-card)] bg-[var(--color-primary-container)] text-[var(--color-primary)]">
                <BarChart3 aria-hidden size={20} />
              </span>
              <div className="min-w-0">
                <p className="coach-body font-semibold text-[var(--color-main)]">{t("weekly_report_summary_title")}</p>
                <p className={NOTE_CLASS}>{period}</p>
              </div>
            </div>
            <span className="coach-footnote rounded-full bg-[var(--color-surface-container)] px-3 py-1 font-semibold text-[var(--color-secondary)]">
              {report.archive.some((item) => item.period.startDate === preview.snapshot.period.startDate)
                ? t("weekly_report_status_finalized")
                : t("weekly_report_status_draft")}
            </span>
          </div>
          <dl className="mt-4 grid grid-cols-3 gap-2 border-y border-[var(--color-border)] py-3">
            <SummaryMetric label={t("weekly_report_focus")} value={`${number.format(preview.snapshot.current.focusMinutes)} ${locale === "tr" ? "dk" : "min"}`} />
            <SummaryMetric label={t("weekly_report_plan_short")} value={`${preview.snapshot.current.completedTasks} / ${preview.snapshot.current.plannedTasks}`} />
            <SummaryMetric label={t("weekly_report_mock_average")} value={mockAverage === null ? t("weekly_report_missing") : number.format(mockAverage)} />
          </dl>
          <Button type="button" variant="ghost" className="mt-2 w-full justify-between" onClick={() => setOpen(true)}>
            {t("weekly_report_open")}
            <ChevronRight aria-hidden size={18} />
          </Button>
        </div>
      </InsetSection>

      <AnimatePresence>
        {open ? (
          <WeeklyReportPanel studentId={studentId} report={report} period={period} formatDate={formatDate} onClose={() => setOpen(false)} />
        ) : null}
      </AnimatePresence>
    </>
  );
}

function SummaryMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 px-1">
      <dt className="coach-footnote truncate text-[var(--color-secondary)]">{label}</dt>
      <dd className="coach-body mt-1 font-semibold tabular-nums text-[var(--color-main)]">{value}</dd>
    </div>
  );
}
