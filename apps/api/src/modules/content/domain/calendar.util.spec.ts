import { describe, expect, it } from "vitest";
import { selectExamForCountdown, toExamCandidates } from "./calendar.util";

describe("selectExamForCountdown", () => {
  it("prefers isCurrent among upcoming exams", () => {
    const rows = toExamCandidates([
      {
        exam: {
          id: "a",
          slug: "kpss-onlisans-2026",
          name: "KPSS Önlisans",
          family: "KPSS",
          variant: "ONLISANS",
          isCurrent: false,
        },
        event: { eventAt: new Date("2026-07-05T06:00:00.000Z") },
      },
      {
        exam: {
          id: "b",
          slug: "kpss-lisans-2026",
          name: "KPSS Lisans",
          family: "KPSS",
          variant: "LISANS",
          isCurrent: true,
        },
        event: { eventAt: new Date("2026-07-12T06:00:00.000Z") },
      },
    ]);
    const picked = selectExamForCountdown(rows, "2026-06-01");
    expect(picked?.slug).toBe("kpss-lisans-2026");
  });

  it("picks nearest upcoming when no isCurrent", () => {
    const rows = toExamCandidates([
      {
        exam: {
          id: "a",
          slug: "kpss-onlisans-2026",
          name: "KPSS Önlisans",
          family: "KPSS",
          variant: "ONLISANS",
          isCurrent: false,
        },
        event: { eventAt: new Date("2026-08-01T06:00:00.000Z") },
      },
      {
        exam: {
          id: "b",
          slug: "kpss-lisans-2026",
          name: "KPSS Lisans",
          family: "KPSS",
          variant: "LISANS",
          isCurrent: false,
        },
        event: { eventAt: new Date("2026-07-12T06:00:00.000Z") },
      },
    ]);
    const picked = selectExamForCountdown(rows, "2026-06-01");
    expect(picked?.examDate).toBe("2026-07-12");
  });

  it("returns null when no upcoming dates", () => {
    const rows = toExamCandidates([
      {
        exam: {
          id: "a",
          slug: "kpss-lisans-2026",
          name: "KPSS Lisans 2026",
          family: "KPSS",
          variant: "LISANS",
          isCurrent: true,
        },
        event: { eventAt: new Date("2025-01-01T06:00:00.000Z") },
      },
    ]);
    expect(selectExamForCountdown(rows, "2026-06-01")).toBeNull();
  });
});
