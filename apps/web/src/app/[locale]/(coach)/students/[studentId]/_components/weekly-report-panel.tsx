"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button, TextAreaField } from "@mentor/ui";
import {
  CoachOverlayBody,
  CoachOverlayFooter,
} from "@/components/coach-overlay";
import {
  NOTE_CLASS,
  PANEL_LINK_BUTTON,
  PANEL_QUIET_BUTTON,
} from "@/components/mentorship/coach-ui";
import { PANEL_TEXT_LINK } from "@/components/panel/panel-styles";
import { Link } from "@/i18n/navigation";
import { firstName } from "@/lib/greeting";
import { dativeOf } from "@/lib/turkish-case";
import { CoachPanel } from "./coach-panel";
import { useWeeklyReportCard } from "./use-weekly-report-card";
import { WeeklyReportArchive } from "./weekly-report-archive";
import { WeeklyReportBrief } from "./weekly-report-brief";
import { WeeklyReportMetrics } from "./weekly-report-metrics";

type WeeklyReportState = ReturnType<typeof useWeeklyReportCard>;

/**
 * The weekly report in the side panel: the week's numbers against the week before, the private
 * preparation, and the evaluation the coach finalizes into a PDF. The one filled button is
 * "Raporu sonlandır"; the PDF is the coach's to send, and the copy says so.
 */
export function WeeklyReportPanel({
  studentId,
  report,
  period,
  archiveOpen = false,
  onClose,
}: {
  studentId: string;
  report: WeeklyReportState;
  /** The shown week in words, "14–20 Eylül". */
  period: string;
  /** Opened from "Arşiv" or the header menu: the finalized reports are what the coach came for. */
  archiveOpen?: boolean;
  onClose: () => void;
}) {
  const t = useTranslations("mentorship");
  if (!report.preview) return null;
  const preview = report.preview;
  const name = firstName(preview.studentDisplayName);
  const previousReport = report.archive.find(
    (item) => item.period.startDate === preview.snapshot.period.startDate,
  );

  return (
    <CoachPanel
      title={t("weekly_report_title")}
      subtitle={`${preview.studentDisplayName} · ${period}`}
      busy={report.busy}
      wide
      onClose={onClose}
    >
      <CoachOverlayBody>
        <div className="flex flex-col gap-5 pb-6">
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              className={PANEL_LINK_BUTTON}
              disabled={report.busy}
              onClick={() => void report.moveWeek(-1)}
            >
              <ChevronLeft className="size-4" aria-hidden />
              {t("weekly_report_previous_week")}
            </button>
            <span className="inline-flex h-6 items-center rounded-[var(--radius-card)] bg-[var(--color-surface-container)] px-2 text-xs font-extrabold text-[var(--color-body)]">
              {previousReport ? t("weekly_report_status_finalized") : t("weekly_report_status_draft")}
            </span>
            <button
              type="button"
              className={PANEL_LINK_BUTTON}
              disabled={
                report.busy ||
                preview.snapshot.period.startDate === report.latestWeek
              }
              onClick={() => void report.moveWeek(1)}
            >
              {t("weekly_report_next_week")}
              <ChevronRight className="size-4" aria-hidden />
            </button>
          </div>
          <WeeklyReportMetrics snapshot={preview.snapshot} subjectNames={preview.subjectNames} />
          <WeeklyReportBrief
            preview={preview}
            coachContext={report.coachContext}
            onContextChange={report.setCoachContext}
            busy={report.busy}
            onGenerate={() => void report.generateBrief()}
          />
          <section className="flex flex-col gap-2">
            <TextAreaField
              label={t("weekly_report_share_title")}
              value={report.evaluation}
              maxLength={1200}
              hint={t("weekly_report_share_hint", {
                count: report.evaluation.length,
                name,
                dative: dativeOf(name),
              })}
              onChange={(event) => report.setEvaluation(event.target.value)}
            />
            {previousReport ? (
              <p className={NOTE_CLASS}>
                {t("weekly_report_correction", {
                  version: previousReport.version + 1,
                })}
              </p>
            ) : null}
          </section>
          <details
            open={archiveOpen}
            className="rounded-[var(--radius-card)] bg-[var(--color-surface)] px-4 py-3"
          >
            <summary className="min-h-11 cursor-pointer content-center text-body-sm font-extrabold text-[var(--color-main)]">
              {t("weekly_report_archive")} ({report.archive.length})
            </summary>
            <div className="pt-4">
              <WeeklyReportArchive
                studentId={studentId}
                items={report.archive}
                showTitle={false}
              />
            </div>
          </details>
        </div>
      </CoachOverlayBody>
      <CoachOverlayFooter>
        {report.finalized ? (
          <Link
            locale={report.finalized.locale}
            className={`${PANEL_TEXT_LINK} px-2`}
            href={{
              pathname: "/students/[studentId]/weekly-reports/[reportId]/print",
              params: { studentId, reportId: report.finalized.id },
            }}
          >
            {t("weekly_report_open_finalized")}
          </Link>
        ) : null}
        <button type="button" className={`${PANEL_QUIET_BUTTON} px-2`} disabled={report.busy} onClick={onClose}>
          {t("confirm_cancel")}
        </button>
        <Button
          type="button"
          busy={report.busy}
          onClick={() => void report.finalize()}
        >
          {t("weekly_report_finalize")}
        </Button>
      </CoachOverlayFooter>
    </CoachPanel>
  );
}
