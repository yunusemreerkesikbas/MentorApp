import { CalendarAddIcon } from "@solar-icons/react/linear/calendar-add";
import { ClockCircleIcon } from "@solar-icons/react/linear/clock-circle";
import { ShieldCheckIcon } from "@solar-icons/react/linear/shield-check";
import { getTranslations } from "next-intl/server";
import { PANEL_CARD, PANEL_CARD_TITLE } from "@/components/panel/panel-styles";
import { fetchExamCalendarByFamily } from "@/lib/content-api";
import { buildExamCalendarIcs } from "@/lib/exam-calendar-export";
import { BLOG_ACTION, BLOG_INLINE_LINK } from "./blog-ui";
import { formatPostDate } from "./post-meta";

/** The family's verified exam date, rendered verbatim (guardrail §4 #1). Same card on the hub and a post. */
export async function ExamDayCard({ family, locale }: { family: string; locale: string }) {
  const [t, ui, calendar] = await Promise.all([
    getTranslations("knowledge"),
    getTranslations("common"),
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

  return (
    <section aria-labelledby="exam-day-title" className={`${PANEL_CARD} flex flex-col gap-3`}>
      <h2 id="exam-day-title" className={PANEL_CARD_TITLE}>
        {t("exam_day")}
      </h2>
      {calendar?.examDateLabel ? (
        <>
          <div>
            <p className="text-title font-black tabular-nums text-[var(--color-main)]">
              {calendar.examDateLabel}
            </p>
            <p className="text-caption font-bold text-[var(--color-secondary)]">{calendar.exam.name}</p>
          </div>
          {calendar.daysRemaining !== null ? (
            // A calm line, not a badge (DESIGN §0: the countdown never alarms).
            <p className="flex items-center gap-1.5 text-caption font-extrabold text-[var(--color-main)]">
              <ClockCircleIcon size={16} strokeWidth={1.75} className="text-[var(--color-secondary)]" />
              {t("days_remaining", { days: calendar.daysRemaining })}
            </p>
          ) : null}
          {examDate ? (
            <p className="flex items-start gap-1.5 text-caption font-bold text-[var(--color-secondary)]">
              <ShieldCheckIcon
                size={16}
                strokeWidth={1.75}
                className="mt-0.5 shrink-0 text-[var(--color-success)]"
              />
              <span>
                {ui("source_prefix")}{" "}
                <a
                  href={examDate.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={BLOG_INLINE_LINK}
                >
                  {examDate.source}
                </a>{" "}
                · {t("last_verified", { date: formatPostDate(examDate.verifiedAt, locale, "long") })}
              </span>
            </p>
          ) : null}
          {ics ? (
            <a
              href={`data:text/calendar;charset=utf-8,${encodeURIComponent(ics)}`}
              download={`${calendar.exam.slug}-takvim.ics`}
              className={`${BLOG_ACTION} self-start`}
            >
              <CalendarAddIcon size={16} strokeWidth={1.75} />
              {t("calendar_download")}
            </a>
          ) : null}
        </>
      ) : (
        <p className="text-body-sm font-semibold text-[var(--color-secondary)]">
          {t("calendar_pending_desc")}
        </p>
      )}
    </section>
  );
}
