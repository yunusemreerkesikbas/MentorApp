"use client";

import { FileText } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  PANEL_CARD,
  PANEL_CARD_TITLE,
  PANEL_QUIET_LINK,
  PANEL_TEXT_LINK,
} from "@/components/panel/panel-styles";
import { firstName } from "@/lib/greeting";
import { dativeOf } from "@/lib/turkish-case";
import { useReportDates } from "./use-report-dates";
import type { useWeeklyReportCard } from "./use-weekly-report-card";
import { shiftIso } from "./week-filmstrip-model";

type WeeklyReport = ReturnType<typeof useWeeklyReportCard>;

/**
 * "Haftalık değerlendirme" in the rail: which week is ready, whether the coach has finished it, and
 * the honest part: the PDF is the coach's to send, nothing reaches the student from here. The numbers
 * live in the panel; the card carries no metric tiles.
 */
export function WeeklyReportCard({
  weekly,
  joinedOn,
  onOpen,
}: {
  weekly: WeeklyReport;
  /**
   * Europe/Istanbul `yyyy-mm-dd` the link started; null when the report has none, undefined while
   * the report is still loading.
   */
  joinedOn: string | null | undefined;
  onOpen: (archive: boolean) => void;
}) {
  const t = useTranslations("mentorship");
  const { range } = useReportDates();
  // Drawn only once there is something true to say, like the follow-up card: a coach without the
  // feature never sees a card flash in and go, and the sentence never lacks its name or its week.
  if (weekly.state === "disabled" || weekly.state === "loading") return null;
  if (weekly.state === "ready" && joinedOn === undefined) return null;
  const name = firstName(weekly.preview?.studentDisplayName ?? "");

  // The latest finished week, whatever week the panel is showing: moving through older weeks there
  // must not move the card (weeks run Monday to Sunday).
  const period =
    weekly.state === "ready" && weekly.latestWeek !== null
      ? { startDate: weekly.latestWeek, endDate: shiftIso(weekly.latestWeek, 6) }
      : null;
  const finalized =
    period !== null && weekly.archive.some((item) => item.period.startDate === period.startDate);
  const beforeLink = period !== null && joinedOn != null && joinedOn > period.endDate;

  return (
    <section className={`${PANEL_CARD} flex flex-col gap-2`} aria-labelledby="weekly-title">
      <div className="flex items-center justify-between gap-3">
        <h2 id="weekly-title" className={PANEL_CARD_TITLE}>
          {t("weekly_report_title")}
        </h2>
        {period && !beforeLink ? (
          <span className="inline-flex h-6 items-center rounded-[var(--radius-card)] bg-[var(--color-surface-container)] px-2 text-xs font-extrabold text-[var(--color-body)]">
            {finalized ? t("weekly_report_status_finalized") : t("weekly_report_status_draft")}
          </span>
        ) : null}
      </div>

      {period === null ? (
        <div role="alert" className="flex flex-col items-start gap-1">
          <p className="text-body-sm font-semibold text-[var(--color-body)]">{t("weekly_report_load_failed")}</p>
          <button type="button" className={PANEL_QUIET_LINK} onClick={() => void weekly.retry()}>
            {t("weekly_report_retry")}
          </button>
        </div>
      ) : (
        <>
          <p className="text-body-sm font-semibold text-[var(--color-body)]">
            {beforeLink
              ? t("weekly_card_new")
              : t(finalized ? "weekly_card_finalized" : "weekly_card_ready", {
                  period: range(period.startDate, period.endDate),
                  name,
                  dative: dativeOf(name),
                })}
          </p>
          <div className="flex flex-wrap items-center gap-x-4">
            {beforeLink ? null : (
              <button type="button" className={`${PANEL_TEXT_LINK} cursor-pointer gap-1.5`} onClick={() => onOpen(false)}>
                <FileText className="size-4" aria-hidden />
                {t("weekly_report_open")}
              </button>
            )}
            {weekly.archive.length > 0 ? (
              <button type="button" className={PANEL_QUIET_LINK} onClick={() => onOpen(true)}>
                {t("weekly_card_archive", { count: weekly.archive.length })}
              </button>
            ) : null}
          </div>
        </>
      )}
    </section>
  );
}
