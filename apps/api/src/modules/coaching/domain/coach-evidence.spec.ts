import type { SubjectStrengthDto } from "@mentor/types";
import { examPhaseFor, weakestSubjects } from "./coach-evidence";

const strength = (
  subjectRef: string,
  normalizedAveragePercent: string | null,
): SubjectStrengthDto => ({
  subjectRef,
  subjectName: subjectRef,
  averageNet: "10.00",
  attemptCount: 2,
  questionCount: normalizedAveragePercent === null ? null : 30,
  normalizedAveragePercent,
  recentAverageNet: null,
  netDelta: null,
});

describe("examPhaseFor", () => {
  it.each([
    ["2026-08-01", "FINAL"],
    ["2026-08-30", "FINAL"],
    ["2026-08-31", "MID"],
    ["2026-10-30", "MID"],
    ["2026-10-31", "FAR"],
    ["2026-07-31", null],
    ["not-a-date", null],
  ] as const)("reads %s from 2026-08-01 as %s", (examDate, phase) => {
    expect(examPhaseFor(examDate, "2026-08-01")).toBe(phase);
  });
});

describe("weakestSubjects", () => {
  it("ranks by normalized average like the analysis focus and skips subjects without a question count", () => {
    const ranked = weakestSubjects([
      strength("turkce", "71.25"),
      strength("matematik", "32.00"),
      strength("tarih", null),
      strength("fen", "41.00"),
    ]);
    expect(ranked.map((subject) => subject.subjectRef)).toEqual([
      "matematik",
      "fen",
    ]);
  });

  it("names a weakest subject only when there is another subject to compare with", () => {
    expect(weakestSubjects([strength("matematik", "32.00")])).toEqual([]);
    expect(
      weakestSubjects([strength("turkce", "71.25"), strength("matematik", "32.00")]).map(
        (subject) => subject.subjectRef,
      ),
    ).toEqual(["matematik"]);
  });

  it("reads the recent window like the analysis focus does, not the lifetime average", () => {
    const ranked = weakestSubjects([
      // Lifetime 30%, but the last attempts average 18/30 = 60%: this student has moved on.
      { ...strength("matematik", "30.00"), recentAverageNet: "18.00" },
      // Lifetime 40%, recent 10.5/30 = 35%: the weakness right now.
      { ...strength("tarih", "40.00"), recentAverageNet: "10.50" },
      { ...strength("turkce", "90.00"), recentAverageNet: "27.00" },
    ]);
    expect(ranked.map((subject) => subject.subjectRef)).toEqual([
      "tarih",
      "matematik",
    ]);
  });

  it("breaks ties by subject ref so the result is stable", () => {
    expect(
      weakestSubjects([
        strength("tarih", "40.00"),
        strength("cografya", "40.00"),
        strength("turkce", "90.00"),
      ]).map((subject) => subject.subjectRef),
    ).toEqual(["cografya", "tarih"]);
  });
});
