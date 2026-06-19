import { describe, expect, it } from "vitest";
import { computeGhost, GhostHeadlineKey, type GhostInput } from "./ghost";

const base = (overrides: Partial<GhostInput> = {}): GhostInput => ({
  latest: {
    id: "m2",
    takenAt: new Date("2026-06-19T10:00:00.000Z"),
    totalNet: "42.00",
    examName: "KPSS Lisans 2026",
  },
  previousNet: "39.00",
  bestPreviousNet: "40.00",
  latestSubjects: [
    { subjectRef: "turkce", net: "25.00" },
    { subjectRef: "matematik", net: "17.00" },
  ],
  previousSubjects: [
    { subjectRef: "turkce", net: "22.00" },
    { subjectRef: "matematik", net: "17.00" },
  ],
  subjectName: (ref) => (ref === "turkce" ? "Türkçe" : "Matematik"),
  ...overrides,
});

describe("computeGhost", () => {
  it("computes signed deltas vs previous and best, with a new-record headline", () => {
    const g = computeGhost(base());
    expect(g.previousDelta).toBe("+3.00");
    expect(g.beatPrevious).toBe(true);
    expect(g.recordDelta).toBe("+2.00"); // 42 - 40
    expect(g.isNewRecord).toBe(true);
    expect(g.headlineKey).toBe(GhostHeadlineKey.NEW_RECORD);
  });

  it("beats previous without a record when best is higher", () => {
    const g = computeGhost(base({ bestPreviousNet: "45.00" }));
    expect(g.isNewRecord).toBe(false);
    expect(g.recordDelta).toBe("-3.00");
    expect(g.headlineKey).toBe(GhostHeadlineKey.BEAT_PREVIOUS);
  });

  it("flags a tie with the previous attempt", () => {
    const g = computeGhost(base({ previousNet: "42.00", bestPreviousNet: "42.00" }));
    expect(g.previousDelta).toBe("0.00");
    expect(g.beatPrevious).toBe(false);
    expect(g.headlineKey).toBe(GhostHeadlineKey.TIED);
  });

  it("flags a drop below the previous attempt", () => {
    const g = computeGhost(base({ previousNet: "45.00", bestPreviousNet: "45.00" }));
    expect(g.previousDelta).toBe("-3.00");
    expect(g.headlineKey).toBe(GhostHeadlineKey.BELOW_PREVIOUS);
  });

  it("produces per-subject deltas and marks new subjects with null previous", () => {
    const g = computeGhost(
      base({
        latestSubjects: [
          { subjectRef: "turkce", net: "25.00" },
          { subjectRef: "tarih", net: "10.00" },
        ],
        previousSubjects: [{ subjectRef: "turkce", net: "22.00" }],
        subjectName: (ref) => (ref === "turkce" ? "Türkçe" : "Tarih"),
      }),
    );
    const turkce = g.subjects.find((s) => s.subjectRef === "turkce");
    const tarih = g.subjects.find((s) => s.subjectRef === "tarih");
    expect(turkce?.delta).toBe("+3.00");
    expect(tarih?.previousNet).toBeNull();
    expect(tarih?.delta).toBeNull();
  });

  it("formats the latest takenAt as ISO", () => {
    expect(computeGhost(base()).latest.takenAt).toBe("2026-06-19T10:00:00.000Z");
  });
});
