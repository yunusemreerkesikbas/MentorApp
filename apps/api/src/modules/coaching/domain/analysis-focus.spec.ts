import type { SubjectStrengthDto } from "@mentor/types";
import { describe, expect, it } from "vitest";
import { buildFocusTrend, selectAnalysisFocus } from "./analysis-focus";

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

describe("buildFocusTrend", () => {
  const attempts = [
    { id: "m4", takenAt: new Date("2026-07-10T10:00:00Z") },
    { id: "m3", takenAt: new Date("2026-07-03T10:00:00Z") },
    { id: "m2", takenAt: new Date("2026-06-26T10:00:00Z") },
    { id: "m1", takenAt: new Date("2026-06-19T10:00:00Z") },
  ];

  it.each([
    ["UP", ["18.00", "16.00", "15.00", "14.00"], "+2.00"],
    ["DOWN", ["14.00", "16.00", "15.00", "14.00"], "-2.00"],
    ["STEADY", ["16.00", "16.00", "15.00", "14.00"], "0.00"],
  ] as const)("returns %s from the latest two subject nets", (direction, nets, delta) => {
    const subjects = new Map(
      attempts.map((attempt, index) => [
        attempt.id,
        [{ subjectRef: "turkce", net: nets[index] }],
      ]),
    );

    expect(buildFocusTrend("turkce", attempts, subjects)).toEqual({
      recentTrend: attempts.map((attempt, index) => ({
        mockExamId: attempt.id,
        takenAt: attempt.takenAt.toISOString(),
        net: nets[index],
      })),
      recentDelta: delta,
      trendDirection: direction,
    });
  });

  it("returns FIRST without a delta when only one point exists", () => {
    expect(
      buildFocusTrend(
        "turkce",
        attempts.slice(0, 1),
        new Map([["m4", [{ subjectRef: "turkce", net: "18.00" }]]]),
      ),
    ).toMatchObject({ recentDelta: null, trendDirection: "FIRST" });
  });
});


