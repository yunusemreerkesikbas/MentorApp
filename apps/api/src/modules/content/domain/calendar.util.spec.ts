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

  it("falls through a stale current marker to the nearest upcoming exam", () => {
    const rows = toExamCandidates([
      {
        exam: {
          id: "past",
          slug: "kpss-lisans-2026",
          name: "KPSS Lisans",
          family: "KPSS",
          variant: "LISANS",
          isCurrent: true,
        },
        event: { eventAt: new Date("2026-07-12T06:00:00.000Z") },
      },
      {
        exam: {
          id: "next",
          slug: "kpss-onlisans-2026",
          name: "KPSS Önlisans",
          family: "KPSS",
          variant: "ONLISANS",
          isCurrent: false,
        },
        event: { eventAt: new Date("2026-07-19T06:00:00.000Z") },
      },
    ]);

    expect(selectExamForCountdown(rows, "2026-07-14")?.slug).toBe(
      "kpss-onlisans-2026",
    );
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

  it("counts down to the candidate's own KPSS guide, not the isCurrent one", () => {
    // The regression this exists for: all three KPSS guides live in `exams`, only the LISANS row
    // carries isCurrent, so an ORTAOGRETIM candidate counted down to 12 July instead of 26 July.
    const rows = toExamCandidates([
      {
        exam: {
          id: "lisans",
          slug: "kpss-lisans-2026",
          name: "KPSS Lisans",
          family: "KPSS",
          variant: "LISANS",
          isCurrent: true,
        },
        event: { eventAt: new Date("2026-07-12T06:00:00.000Z") },
      },
      {
        exam: {
          id: "ortaogretim",
          slug: "kpss-ortaogretim-2026",
          name: "KPSS Ortaöğretim",
          family: "KPSS",
          variant: "ORTAOGRETIM",
          isCurrent: false,
        },
        event: { eventAt: new Date("2026-07-26T06:00:00.000Z") },
      },
    ]);

    expect(selectExamForCountdown(rows, "2026-06-01", "ORTAOGRETIM")?.examDate).toBe(
      "2026-07-26",
    );
    // No variant (YKS/LGS, or a KPSS profile from before the field existed) keeps the old answer.
    expect(selectExamForCountdown(rows, "2026-06-01")?.examDate).toBe("2026-07-12");
  });

  it("falls back to the whole family when the stored variant matches nothing", () => {
    // A stale variant on a profile must not blank out the countdown entirely.
    const rows = toExamCandidates([
      {
        exam: {
          id: "lisans",
          slug: "kpss-lisans-2026",
          name: "KPSS Lisans",
          family: "KPSS",
          variant: "LISANS",
          isCurrent: true,
        },
        event: { eventAt: new Date("2026-07-12T06:00:00.000Z") },
      },
    ]);

    expect(selectExamForCountdown(rows, "2026-06-01", "ONLISANS")?.examDate).toBe(
      "2026-07-12",
    );
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
