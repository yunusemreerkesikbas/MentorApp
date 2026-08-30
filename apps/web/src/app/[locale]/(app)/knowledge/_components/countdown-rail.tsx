"use client";

import { useLocale, useTranslations } from "next-intl";
import type { ExamCalendarDto } from "@mentor/types";
import { buildExamCalendarIcs } from "@/lib/exam-calendar-export";

export function CountdownRail({ calendar }: { calendar: ExamCalendarDto | null }) {
  const t = useTranslations("knowledge");
  const ui = useTranslations("common");
  const locale = useLocale();
  const examDateEvent = calendar?.events.find((event) => event.type === "EXAM_DATE");
  const verifiedLabel = examDateEvent
    ? new Intl.DateTimeFormat(locale, {
        day: "numeric",
        month: "long",
        year: "numeric",
      }).format(new Date(examDateEvent.verifiedAt))
    : null;
  const calendarIcs = calendar?.nextEvent
    ? buildExamCalendarIcs(calendar, {
        locale,
        calendarName: t("calendar_name"),
        eventLabels: {
          APPLICATION_START: t("timeline.application_start"),
          APPLICATION_END: t("timeline.application_end"),
          EXAM_DATE: t("timeline.exam_date"),
          RESULT_DATE: t("timeline.result_date"),
        },
        sourcePrefix: t("source_label"),
        lastVerifiedPrefix: t("last_verified_prefix"),
      })
    : null;

  if (!calendar?.examDateLabel) {
    return (
      <section>
        <h2
          className="text-sm font-bold"
          style={{ color: "var(--color-main)", fontFamily: "var(--font-heading)" }}
        >
          {t("exam_day")}
        </h2>
        <p className="mt-2 text-sm" style={{ color: "var(--color-secondary)" }}>
          {t("calendar_pending_desc")}
        </p>
      </section>
    );
  }

  return (
    <section>
      <p className="text-sm font-semibold" style={{ color: "var(--color-secondary)" }}>
        {t("exam_day")}
      </p>
      <p
        className="mt-1 text-xl font-bold"
        style={{ color: "var(--color-main)", fontFamily: "var(--font-heading)" }}
      >
        {calendar.examDateLabel}
      </p>
      <p className="mt-1 text-sm" style={{ color: "var(--color-secondary)" }}>
        {calendar.exam.name}
      </p>
      {calendar.daysRemaining !== null ? (
        <p className="mt-1 text-sm" style={{ color: "var(--color-secondary)" }}>
          {t("days_remaining", { days: calendar.daysRemaining })}
        </p>
      ) : null}
      {verifiedLabel ? (
        <p className="mt-1 text-xs" style={{ color: "var(--color-secondary)" }}>
          {t("last_verified", { date: verifiedLabel })}
        </p>
      ) : null}
      {examDateEvent ? (
        <a
          href={examDateEvent.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-flex min-h-11 items-center text-sm font-semibold underline underline-offset-2"
          style={{ color: "var(--color-secondary)" }}
        >
          {ui("source_prefix")} {examDateEvent.source}
        </a>
      ) : null}
      {calendarIcs ? (
        <a
          href={`data:text/calendar;charset=utf-8,${encodeURIComponent(calendarIcs)}`}
          download={`${calendar.exam.slug}-takvim.ics`}
          className="mt-1 flex min-h-11 items-center text-sm font-semibold transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2"
          style={{ color: "var(--color-main)", fontFamily: "var(--font-heading)" }}
        >
          {t("calendar_download")}
        </a>
      ) : null}
    </section>
  );
}
