import { getTranslations } from "next-intl/server";
import type { ExamCalendarDto, InfoArticleSummaryDto } from "@mentor/types";
import { Link } from "@/i18n/navigation";
import { ARTICLE_CATEGORIES, infoArticleUrl } from "@/lib/content-api";
import { buildExamCalendarIcs } from "@/lib/exam-calendar-export";
import { ShareRow } from "../../../(app)/knowledge/_components/share-row";

const chipBorder = "color-mix(in srgb, var(--color-main) 16%, transparent)";

export async function PublicArticleSidebar({
  calendar,
  related,
  locale,
  share,
}: {
  calendar: ExamCalendarDto | null;
  related: InfoArticleSummaryDto[];
  locale: string;
  share: { title: string; slug: string };
}) {
  const [t, ui] = await Promise.all([
    getTranslations("knowledge"),
    getTranslations("common"),
  ]);
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

  return (
    <aside className="flex min-w-0 flex-col gap-8">
      <section>
        {calendar?.examDateLabel ? (
          <>
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
          </>
        ) : (
          <>
            <h2
              className="text-sm font-bold"
              style={{ color: "var(--color-main)", fontFamily: "var(--font-heading)" }}
            >
              {t("exam_day")}
            </h2>
            <p className="mt-2 text-sm" style={{ color: "var(--color-secondary)" }}>
              {t("calendar_pending_desc")}
            </p>
          </>
        )}
      </section>

      <section>
        <h2
          className="text-sm font-bold"
          style={{ color: "var(--color-main)", fontFamily: "var(--font-heading)" }}
        >
          {t("recommended_topics")}
        </h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {ARTICLE_CATEGORIES.map((category) => (
            <span
              key={category}
              className="inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-medium"
              style={{
                borderColor: chipBorder,
                backgroundColor: "var(--color-surface)",
                color: "var(--color-main)",
              }}
            >
              {t(`categories.${category.toLowerCase()}`)}
            </span>
          ))}
        </div>
      </section>

      {related.length > 0 ? (
        <section>
          <h2
            className="text-sm font-bold"
            style={{ color: "var(--color-main)", fontFamily: "var(--font-heading)" }}
          >
            {t("related_posts")}
          </h2>
          <ul className="mt-3 flex flex-col gap-4">
            {related.map((article) => (
              <li key={article.slug}>
                <Link
                  href={{ pathname: "/knowledge/[slug]", params: { slug: article.slug } }}
                  className="flex items-start justify-between gap-3 rounded-[var(--radius-card)] focus-visible:outline-none focus-visible:ring-2"
                >
                  <div className="min-w-0">
                    <p className="text-xs" style={{ color: "var(--color-secondary)" }}>
                      {t(`categories.${article.category.toLowerCase()}`)}
                    </p>
                    <p
                      className="mt-1 text-balance text-sm font-bold"
                      style={{ color: "var(--color-main)", fontFamily: "var(--font-heading)" }}
                    >
                      {article.title}
                    </p>
                    {article.publishedAt ? (
                      <p className="mt-1 text-xs" style={{ color: "var(--color-secondary)" }}>
                        {new Intl.DateTimeFormat(locale, {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        }).format(new Date(article.publishedAt))}
                      </p>
                    ) : null}
                  </div>
                  {article.coverImage ? (
                    // eslint-disable-next-line @next/next/no-img-element -- editorial thumb
                    <img
                      src={article.coverImage.url}
                      alt={article.coverImage.alt}
                      width={72}
                      height={72}
                      className="h-[72px] w-[72px] shrink-0 rounded-[var(--radius-card)] object-cover"
                    />
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <ShareRow title={share.title} url={infoArticleUrl(share.slug)} />
    </aside>
  );
}
