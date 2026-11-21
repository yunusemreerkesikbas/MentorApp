import { describe, expect, it } from "vitest";

import type { ExamEventRow, ExamRow } from "../infrastructure/exam.repository";
import { todayIso } from "../domain/date.util";
import { toExamCalendarDto } from "./content.mappers";

describe("toExamCalendarDto", () => {
  it("returns the next event and its remaining days", () => {
    const now = new Date("2026-07-18T00:00:00.000Z");
    const exam = {
      id: "exam-id",
      slug: "kpss-lisans-2026",
      name: "KPSS Lisans 2026",
      family: "KPSS",
      variant: "LISANS",
      netRule: { kind: "PENALTY", divisor: 4 },
      isCurrent: true,
      orgId: null,
      createdAt: now,
      updatedAt: now,
    } as ExamRow;
    const events = [
      event("EXAM_DATE", "2026-07-12T06:00:00.000Z", now),
      event("RESULT_DATE", "2026-08-01T07:00:00.000Z", now),
      event("APPLICATION_END", "2026-07-20T07:00:00.000Z", now),
    ];

    const calendar = toExamCalendarDto(exam, events, "2026-07-18");

    expect(calendar.nextEvent?.type).toBe("APPLICATION_END");
    expect(calendar.daysUntilNextEvent).toBe(2);
  });

  it("uses the Europe/Istanbul calendar day by default after midnight in Türkiye", () => {
    const now = new Date("2026-11-20T22:05:00.000Z"); // 2026-11-21 01:05 in Europe/Istanbul
    const exam = {
      id: "exam-ales",
      slug: "ales-2026-3",
      name: "ALES 2026/3",
      family: "ALES",
      variant: null,
      netRule: { kind: "PENALTY", divisor: 4 },
      isCurrent: true,
      orgId: null,
      createdAt: now,
      updatedAt: now,
    } as ExamRow;
    const events = [event("EXAM_DATE", "2026-11-29T07:15:00.000Z", now)];

    const calendar = toExamCalendarDto(exam, events, todayIso(now));

    expect(calendar.daysRemaining).toBe(8);
  });
});

function event(type: string, eventAt: string, now: Date): ExamEventRow {
  return {
    id: `event-${type}`,
    examId: "exam-id",
    type,
    eventAt: new Date(eventAt),
    source: "�SYM",
    sourceUrl: "https://www.osym.gov.tr",
    verifiedAt: now,
    verifiedBy: "editorial-test",
    createdAt: now,
    updatedAt: now,
  };
}
