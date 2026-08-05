import { describe, expect, it } from "vitest";
import type { ExamCalendarDto, ExamEventDto } from "@mentor/types";

import { buildExamCalendarIcs } from "./exam-calendar-export";

describe("buildExamCalendarIcs", () => {
  it("exports upcoming verified events as escaped all-day calendar rows", () => {
    const nextEvent = event(
      "APPLICATION_END",
      "2026-07-20T07:00:00.000Z",
      "�SYM, Resm�; Birim",
    );
    const calendar: ExamCalendarDto = {
      exam: {
        id: "exam-id",
        slug: "kpss-lisans-2026",
        name: "KPSS, Lisans 2026",
        family: "KPSS",
        variant: "LISANS",
        isCurrent: true,
      },
      events: [
        event("APPLICATION_START", "2026-07-01T07:00:00.000Z"),
        nextEvent,
        event("EXAM_DATE", "2026-07-26T06:00:00.000Z"),
      ],
      examDateLabel: "26 Temmuz 2026",
      daysRemaining: 8,
      nextEvent,
      daysUntilNextEvent: 2,
    };

    const ics = buildExamCalendarIcs(calendar, {
      locale: "tr",
      calendarName: "Mentor Bilgi Merkezi",
      eventLabels: {
        APPLICATION_START: "Basvuru baslangici",
        APPLICATION_END: "Basvuru sonu",
        EXAM_DATE: "Sinav g�n�",
      },
      sourcePrefix: "Kaynak",
      lastVerifiedPrefix: "Son dogrulama",
    });

    expect(ics).not.toContain("exam-id-APPLICATION_START@mentor");
    expect(ics).toContain("UID:exam-id-APPLICATION_END@mentor");
    expect(ics).toContain("UID:exam-id-EXAM_DATE@mentor");
    expect(ics).toContain("DTSTART;VALUE=DATE:20260720");
    expect(ics).toContain("SUMMARY:KPSS\\, Lisans 2026 - Basvuru sonu");
    expect(ics).toContain("�SYM\\, Resm�\\; Birim");
    expect(ics).toContain("URL:https://www.osym.gov.tr");
    expect(ics).toContain("Son dogrulama: 18 Temmuz 2026");
    expect(ics).toContain("\r\n");
  });
});

function event(type: string, eventAt: string, source = "�SYM"): ExamEventDto {
  return {
    type,
    eventAt,
    source,
    sourceUrl: "https://www.osym.gov.tr",
    verifiedAt: "2026-07-18T10:00:00.000Z",
    verifiedBy: "editorial-test",
  };
}
