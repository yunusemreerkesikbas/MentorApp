"use client";

import { useEffect, useId, useState } from "react";
import { ChevronRight, FileText } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import type { MentorshipWeeklyReportListItemDto } from "@mentor/types";
import { PANEL_CARD, PANEL_CARD_TITLE, PANEL_TEXT_LINK } from "@/components/panel/panel-styles";
import { Link } from "@/i18n/navigation";
import { fetchMyWeeklyReports } from "@/lib/mentorship-weekly-report";

/** The latest week on its own row; the rest wait behind "Önceki haftalar". */
const SHOWN = 1;

/** A report's day, read at noon UTC so no time zone moves it to the day before. */
const atNoon = (day: string) => new Date(`${day}T12:00:00.000Z`);

/**
 * The weeks the coach finalized (QA F5, 2026-09-27). Not drawn at all until there is one: this card
 * is extra to the transparency screen, and the feature flag may be off, so a failure stays quiet.
 */
export function MyWeeklyReportsCard({ coachName }: { coachName: string }) {
  const t = useTranslations("mentorship");
  const locale = useLocale();
  const titleId = useId();
  const [items, setItems] = useState<MentorshipWeeklyReportListItemDto[]>([]);

  useEffect(() => {
    fetchMyWeeklyReports()
      .then((page) => setItems(page.items))
      .catch(() => undefined);
  }, []);

  if (items.length === 0) return null;

  // "21–27 Eylül", "31 Ağustos – 6 Eylül": the platform's own range format, no hand-built dash.
  const days = new Intl.DateTimeFormat(locale, { day: "numeric", month: "long" });
  const row = (item: MentorshipWeeklyReportListItemDto) => (
    <li key={item.id}>
      <Link
        href={{ pathname: "/my-coach/weekly-reports/[reportId]", params: { reportId: item.id } }}
        className="group flex min-h-18 items-center gap-3.5 rounded-[var(--radius-card)] py-2.5 outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
      >
        <FileText aria-hidden className="size-5.5 shrink-0 text-[var(--coach-accent)]" strokeWidth={1.75} />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-body-sm font-extrabold text-[var(--color-main)] group-hover:underline">
            {days.formatRange(atNoon(item.period.startDate), atNoon(item.period.endDate))}
          </span>
          <span className="text-caption font-semibold text-[var(--color-secondary)]">
            {t("my_weekly_report_row_meta", { name: coachName, date: days.format(new Date(item.finalizedAt)) })}
          </span>
        </span>
        <ChevronRight aria-hidden className="size-4.5 shrink-0 text-[var(--color-secondary)]" strokeWidth={1.75} />
      </Link>
    </li>
  );

  return (
    <section aria-labelledby={titleId} className={`${PANEL_CARD} flex flex-col gap-1`}>
      <h2 id={titleId} className={PANEL_CARD_TITLE}>
        {t("my_weekly_reports_title")}
      </h2>
      <ul>{items.slice(0, SHOWN).map(row)}</ul>
      {items.length > SHOWN && (
        <details className="border-t border-[var(--play-line)] pt-1">
          <summary className={`${PANEL_TEXT_LINK} cursor-pointer list-none`}>
            {t("my_weekly_reports_older", { count: items.length - SHOWN })}
          </summary>
          <ul>{items.slice(SHOWN).map(row)}</ul>
        </details>
      )}
    </section>
  );
}
