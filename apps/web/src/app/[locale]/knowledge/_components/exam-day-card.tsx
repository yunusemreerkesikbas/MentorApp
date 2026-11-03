import { CalendarAddIcon } from "@solar-icons/react/linear/calendar-add";
import { CountdownCard, DataCard } from "@mentor/ui";
import { getTranslations } from "next-intl/server";
import { fetchExamCalendarByFamily } from "@/lib/content-api";
import { buildExamCalendarIcs } from "@/lib/exam-calendar-export";
import { BLOG_ACTION } from "./blog-ui";

/** The family's verified exam date, rendered verbatim (guardrail §4 #1). Same card on the hub and a post. */
export async function ExamDayCard({ family, locale }: { family: string; locale: string }) {
  const [t, ui, countdown, calendar] = await Promise.all([
    getTranslations("knowledge"),
    getTranslations("common"),
    getTranslations("countdown"),
    // API down: `undefined`, and the card says nothing rather than something untrue.
    fetchExamCalendarByFamily(family, { revalidate: 3600 }).catch(() => undefined),
  ]);
  if (calendar === undefined) return null;

  const examDate = calendar?.events.find((event) => event.type === "EXAM_DATE");
  const ics = calendar?.nextEvent
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

  const source = examDate ? { label: examDate.source, url: examDate.sourceUrl, prefix: ui("source_prefix") } : undefined;
  const download = ics && calendar ? (
    <a href={`data:text/calendar;charset=utf-8,${encodeURIComponent(ics)}`}
      download={`${calendar.exam.slug}-takvim.ics`} className={`${BLOG_ACTION} mt-3 self-start`}>
      <CalendarAddIcon size={16} strokeWidth={1.75} />{t("calendar_download")}
    </a>
  ) : null;
  if (calendar?.examDateLabel && calendar.daysRemaining !== null) {
    return <CountdownCard daysRemaining={calendar.daysRemaining} examName={calendar.exam.name}
      examDateLabel={calendar.examDateLabel} source={source}
      labels={{ remaining: countdown("title"), dayUnit: countdown("day_unit"), today: countdown("today") }}>
      {download}
    </CountdownCard>;
  }
  return <DataCard label={t("exam_day")} value={calendar?.examDateLabel ?? t("calendar_pending_desc")}
    caption={calendar?.exam.name} source={source}>{download}</DataCard>;
}
