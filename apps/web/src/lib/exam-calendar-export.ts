import type { ExamCalendarDto, ExamEventDto } from "@mentor/types";

export interface ExamCalendarIcsCopy {
  locale: string;
  calendarName: string;
  eventLabels: Record<string, string>;
  sourcePrefix: string;
  lastVerifiedPrefix: string;
}

const CRLF = "\r\n";

/**
 * Build the small RFC 5545 subset needed for verified, all-day exam events.
 * If event text grows substantially, add RFC line folding here.
 */
export function buildExamCalendarIcs(
  calendar: ExamCalendarDto,
  copy: ExamCalendarIcsCopy,
): string {
  const threshold = calendar.nextEvent?.eventAt;
  const events = threshold
    ? calendar.events
        .filter((event) => event.eventAt >= threshold)
        .sort(compareEvents)
    : [];

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Mentor//Bilgi Merkezi//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeIcsText(copy.calendarName)}`,
    ...events.flatMap((event) => eventLines(calendar, event, copy)),
    "END:VCALENDAR",
  ];

  return `${lines.join(CRLF)}${CRLF}`;
}

function eventLines(
  calendar: ExamCalendarDto,
  event: ExamEventDto,
  copy: ExamCalendarIcsCopy,
): string[] {
  const eventLabel = copy.eventLabels[event.type];
  if (!eventLabel) {
    throw new Error(`Missing calendar label for event type: ${event.type}`);
  }

  const verifiedLabel = new Intl.DateTimeFormat(copy.locale, {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(event.verifiedAt));

  const description = [
    `${copy.sourcePrefix}: ${event.source}`,
    event.sourceUrl,
    `${copy.lastVerifiedPrefix}: ${verifiedLabel}`,
  ].join("\n");

  return [
    "BEGIN:VEVENT",
    `UID:${calendar.exam.id}-${event.type}@mentor`,
    `DTSTAMP:${toUtcTimestamp(event.verifiedAt)}`,
    `DTSTART;VALUE=DATE:${toAllDayDate(event.eventAt)}`,
    `SUMMARY:${escapeIcsText(`${calendar.exam.name} - ${eventLabel}`)}`,
    `DESCRIPTION:${escapeIcsText(description)}`,
    `URL:${event.sourceUrl}`,
    "STATUS:CONFIRMED",
    "TRANSP:TRANSPARENT",
    "END:VEVENT",
  ];
}

function compareEvents(left: ExamEventDto, right: ExamEventDto): number {
  return (
    left.eventAt.localeCompare(right.eventAt) ||
    left.type.localeCompare(right.type)
  );
}

function toAllDayDate(value: string): string {
  return value.slice(0, 10).replaceAll("-", "");
}

function toUtcTimestamp(value: string): string {
  return new Date(value)
    .toISOString()
    .replaceAll("-", "")
    .replaceAll(":", "")
    .replace(/\.\d{3}Z$/, "Z");
}

function escapeIcsText(value: string): string {
  return value
    .replaceAll("\\", "\\\\")
    .replace(/\r?\n/g, "\\n")
    .replaceAll(";", "\\;")
    .replaceAll(",", "\\,");
}
