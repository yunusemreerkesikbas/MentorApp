import type { SubjectStrengthDto } from "@mentor/types";
import { describe, expect, it } from "vitest";
import { selectAnalysisFocus } from "./analysis-focus";

describe("selectAnalysisFocus", () => {
  it("prefers the most frequent photo signal and breaks ties by subject ref", () => {
    expect(
      selectAnalysisFocus(
        [
          {
            subjectRef: "turkce",
            subjectName: "Türkçe",
            averageNet: "5.00",
            attemptCount: 2,
            questionCount: 30,
            normalizedAveragePercent: "16.67",
          },
        ] as SubjectStrengthDto[],
        [
          { subjectRef: "tarih", subjectName: "Tarih", count: 3 },
          { subjectRef: "cografya", subjectName: "Coğrafya", count: 3 },
        ],
      ),
    ).toEqual({
      subjectRef: "cografya",
      subjectName: "Coğrafya",
      source: "PHOTO_SIGNAL",
      evidenceCount: 3,
      evidenceLevel: "REPEATED",
    });
  });

  it("compares normalized performance instead of raw net", () => {
    expect(
      selectAnalysisFocus(
        [
          {
            subjectRef: "turkce",
            subjectName: "Türkçe",
            averageNet: "12.00",
            attemptCount: 1,
            questionCount: 30,
            normalizedAveragePercent: "40.00",
          },
          {
            subjectRef: "guncel-bilgiler",
            subjectName: "Güncel Bilgiler",
            averageNet: "3.00",
            attemptCount: 1,
            questionCount: 6,
            normalizedAveragePercent: "50.00",
          },
        ] as SubjectStrengthDto[],
        [],
      ),
    ).toEqual({
      subjectRef: "turkce",
      subjectName: "Türkçe",
      source: "LOWEST_AVERAGE",
      evidenceCount: 1,
      evidenceLevel: "EARLY",
    });
  });

  it("uses normalized performance to break equal photo-signal counts", () => {
    expect(
      selectAnalysisFocus(
        [
          {
            subjectRef: "turkce",
            subjectName: "Türkçe",
            averageNet: "12.00",
            attemptCount: 2,
            questionCount: 30,
            normalizedAveragePercent: "40.00",
          },
          {
            subjectRef: "tarih",
            subjectName: "Tarih",
            averageNet: "16.20",
            attemptCount: 2,
            questionCount: 27,
            normalizedAveragePercent: "60.00",
          },
        ] as SubjectStrengthDto[],
        [
          { subjectRef: "tarih", subjectName: "Tarih", count: 1 },
          { subjectRef: "turkce", subjectName: "Türkçe", count: 1 },
        ],
      ),
    ).toMatchObject({ subjectRef: "turkce", evidenceLevel: "EARLY" });
  });

  it("returns null without analysis evidence", () => {
    expect(selectAnalysisFocus([], [])).toBeNull();
  });
});
