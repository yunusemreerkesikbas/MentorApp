import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { EXAM_CATALOG, EXAM_TYPES, ExamType } from "@mentor/types";
import { computeSubjectNet, computeTotalNet } from "../../coaching/domain/net";
import { selectExamForCountdown, toExamCandidates } from "../domain/calendar.util";

interface SeedExam {
  slug: string;
  name: string;
  family: string;
  variant: string | null;
  isCurrent: boolean;
  netRule: { kind: string; divisor: number };
  events: Array<{ type: string; eventAt: string; sourceUrl: string; verifiedAt: string }>;
}

const { exams } = JSON.parse(readFileSync(resolve(__dirname, "../seed/exams.seed.json"), "utf8")) as { exams: SeedExam[] };

describe("prepared exam catalogue", () => {
  it("preserves existing codes and exposes only the first prepared group", () => {
    expect(EXAM_TYPES).toEqual(["KPSS", "YKS", "LGS", "ALES", "DGS"]);
    expect(Object.values(ExamType)).toEqual(EXAM_TYPES);
    expect(EXAM_CATALOG.KPSS.variants).toEqual(["LISANS", "ONLISANS", "ORTAOGRETIM"]);
    expect(EXAM_TYPES.every((family) => exams.some((exam) => exam.family === family))).toBe(true);
  });

  it.each(["ALES", "DGS"] as const)("uses the verified %s penalty rule for both test sections", (family) => {
    const editions = exams.filter((exam) => exam.family === family);
    expect(editions.length).toBeGreaterThan(0);
    for (const edition of editions) {
      expect(edition.netRule).toEqual({ kind: "PENALTY", divisor: 4 });
      const nets = [
        computeSubjectNet({ correct: 40, wrong: 8, blank: 2 }, edition.netRule),
        computeSubjectNet({ correct: 45, wrong: 4, blank: 1 }, edition.netRule),
      ];
      expect(computeTotalNet(nets)).toBe(82);
      expect(edition.events.every((event) => new URL(event.sourceUrl).hostname.endsWith("osym.gov.tr") && !Number.isNaN(Date.parse(event.verifiedAt)))).toBe(true);
    }
  });

  it.each([
    ["2026-11-03", "ales-3-2026", "2026-11-29"],
    ["2026-11-30", "ales-1-2027", "2027-04-18"],
    ["2027-04-19", "ales-2-2027", "2027-07-11"],
    ["2027-07-12", "ales-3-2027", "2027-11-28"],
  ])("rolls ALES forward on %s without counting down to an expired period", (today, slug, examDate) => {
    const candidates = toExamCandidates(exams.filter((exam) => exam.family === "ALES").map((exam) => ({
      exam: { ...exam, id: exam.slug },
      event: { eventAt: new Date(exam.events.find((event) => event.type === "EXAM_DATE")!.eventAt) },
    })));
    expect(selectExamForCountdown(candidates, today)).toMatchObject({ slug, examDate });
    expect(selectExamForCountdown(candidates, "2027-11-29")).toBeNull();
  });

  it("uses the 2027 calendar for DGS, with separate application and result dates", () => {
    const dgs = exams.find((exam) => exam.slug === "dgs-2027")!;
    expect(Object.fromEntries(dgs.events.map((event) => [event.type, event.eventAt.slice(0, 10)]))).toEqual({
      EXAM_DATE: "2027-07-18", APPLICATION_START: "2027-05-26",
      APPLICATION_END: "2027-06-03", RESULT_DATE: "2027-08-12",
    });
  });
});
