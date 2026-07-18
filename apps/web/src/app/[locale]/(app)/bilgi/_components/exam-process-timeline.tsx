"use client";

import { useLocale, useTranslations } from "next-intl";
import type { ExamEventDto } from "@mentor/types";
import { Card, Chip } from "@mentor/ui";

const EVENT_LABEL_KEYS = {
  APPLICATION_START: "application_start",
  APPLICATION_END: "application_end",
  EXAM_DATE: "exam_date",
  RESULT_DATE: "result_date",
} as const;

type SupportedEventType = keyof typeof EVENT_LABEL_KEYS;

export function ExamProcessTimeline({
  events,
  nextEvent,
  daysUntilNextEvent,
}: {
  events: ExamEventDto[];
  nextEvent: ExamEventDto | null;
  daysUntilNextEvent: number | null;
}) {
  const locale = useLocale();
  const t = useTranslations("knowledge.timeline");
  const knowledge = useTranslations("knowledge");
  const common = useTranslations("common");
  const supportedEvents = events
    .filter((event): event is ExamEventDto & { type: SupportedEventType } =>
      Object.hasOwn(EVENT_LABEL_KEYS, event.type),
    )
    .sort(
      (left, right) => Date.parse(left.eventAt) - Date.parse(right.eventAt),
    );

  if (!supportedEvents.some((event) => event.type !== "EXAM_DATE")) {
    return null;
  }

  const formatDate = (value: string) =>
    new Intl.DateTimeFormat(locale, {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(new Date(value));

  return (
    <section aria-labelledby="exam-process-title">
      <h2
        id="exam-process-title"
        className="text-xl font-bold"
        style={{
          color: "var(--color-main)",
          fontFamily: "var(--font-heading)",
        }}
      >
        {t("title")}
      </h2>
      <p className="mt-1 text-sm" style={{ color: "var(--color-secondary)" }}>
        {t("subtitle")}
      </p>

      <Card className="mt-4">
        <ol className="divide-y" style={{ borderColor: "var(--color-border)" }}>
          {supportedEvents.map((event) => (
            <li
              key={`${event.type}-${event.eventAt}`}
              className="rounded-[var(--radius-card)] px-3 py-4 first:pt-0 last:pb-0"
              style={
                event.type === nextEvent?.type &&
                event.eventAt === nextEvent.eventAt
                  ? {
                      backgroundColor:
                        "color-mix(in srgb, var(--color-chip) 18%, transparent)",
                    }
                  : undefined
              }
            >
              <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-start">
                <div>
                  {event.type === nextEvent?.type &&
                  event.eventAt === nextEvent.eventAt &&
                  daysUntilNextEvent !== null ? (
                    <Chip className="mb-2 px-3 py-1 text-xs">
                      {daysUntilNextEvent === 0
                        ? t("next_step_today")
                        : daysUntilNextEvent === 1
                          ? t("next_step_tomorrow")
                          : t("next_step_days", {
                              days: daysUntilNextEvent,
                            })}
                    </Chip>
                  ) : null}
                  <p
                    className="font-semibold"
                    style={{
                      color: "var(--color-main)",
                      fontFamily: "var(--font-heading)",
                    }}
                  >
                    {t(EVENT_LABEL_KEYS[event.type])}
                  </p>
                  <time
                    dateTime={event.eventAt}
                    className="mt-1 block text-sm"
                    style={{ color: "var(--color-secondary)" }}
                  >
                    {formatDate(event.eventAt)}
                  </time>
                </div>
                <div
                  className="text-sm sm:text-right"
                  style={{ color: "var(--color-secondary)" }}
                >
                  <a
                    href={event.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-11 items-center font-semibold underline underline-offset-2 transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 motion-reduce:transition-none"
                  >
                    {common("source_prefix")}: {event.source} ↗
                  </a>
                  <p className="text-xs">
                    {knowledge("last_verified", {
                      date: formatDate(event.verifiedAt),
                    })}
                  </p>
                </div>
              </div>
            </li>
          ))}
        </ol>
      </Card>
    </section>
  );
}
