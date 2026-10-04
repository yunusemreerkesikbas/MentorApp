import { describe, expect, it } from "vitest";
import type {
  AnalysisFocusDto,
  AnalysisImprovementCycleDto,
  CoachingAnalysisDto,
} from "@mentor/types";
import { buildFocusPath, needsFocusDueCount } from "./focus-path-model";

const EXAM = "exam-1";

const base: CoachingAnalysisDto = {
  trend: [],
  subjects: [],
  photoSubjectSignals: [],
  photoTopicSignals: [],
  notebookErrorSignals: [],
  notebookErrorMessage: null,
  notebookStats: { windowDays: 60, savedCount: 0, reviewedCount: 0, dueCount: 0, healedCount: 0 },
  improvementCycle: null,
  nextFocus: null,
  personalRecordNet: null,
  ghost: null,
};

const trend = [{ id: "m2", takenAt: "2026-08-10T12:00:00Z", totalNet: "48.00", examName: "KPSS" }];

const focus: AnalysisFocusDto = {
  subjectRef: "matematik",
  subjectName: "Matematik",
  topicRef: "problemler",
  topicName: "Problemler",
  source: "PHOTO_SIGNAL",
  evidenceCount: 3,
  evidenceLevel: "REPEATED",
  message: "Problemler yanlış defterinde tekrar ediyor.",
  suggestedTaskTitle: "Problemler tekrarı",
  recentTrend: [{ mockExamId: "m1", takenAt: "2026-08-09T12:00:00Z", net: "12.00" }],
  recentDelta: null,
  trendDirection: "FIRST",
  trendMessage: "İlk nokta.",
};

function cycle(
  steps: Partial<AnalysisImprovementCycleDto["steps"]>,
  overrides: Partial<AnalysisImprovementCycleDto> = {},
): AnalysisImprovementCycleDto {
  const practiced = steps.practiced ?? false;
  const measured = steps.measured ?? false;
  return {
    task: { id: "t1", title: "Tarih tekrarı", status: "PENDING", taskDate: "2026-09-12", createdAt: "2026-09-12T08:00:00Z" },
    focus: { subjectRef: "tarih", subjectName: "Tarih", source: "LOWEST_AVERAGE", evidenceCount: 2 },
    baseline: { mockExamId: "m1", takenAt: "2026-08-09T12:00:00Z", net: "12.00" },
    notebook: { matchingCount: 5, reviewedAfterPlanCount: 3, dueCount: 2, healedCount: 0 },
    steps: { planned: true, practiced, measured, closed: practiced && measured },
    followUp: measured ? { mockExamId: "m2", takenAt: "2026-08-10T12:00:00Z", net: "14.00", delta: "+2.00" } : null,
    message: "Tarih için plana bağlandın.",
    ...overrides,
  };
}

const states = (view: ReturnType<typeof buildFocusPath>) =>
  view && view.kind === "focus" ? view.steps.map((step) => step.state) : null;

describe("buildFocusPath", () => {
  it("shows the empty path before the first exam, and nothing when exams exist without a focus", () => {
    expect(buildFocusPath(base, EXAM, null)).toEqual({ kind: "empty" });
    expect(buildFocusPath({ ...base, trend }, EXAM, null)).toBeNull();
  });

  it("offers to plan a fresh signal", () => {
    const view = buildFocusPath({ ...base, trend, nextFocus: focus }, EXAM, null);
    expect(states(view)).toEqual(["done", "current", "upcoming", "upcoming"]);
    expect(view).toMatchObject({
      cycleState: "signal",
      proposal: null,
      coachMockExamId: "m1",
      cta: {
        kind: "ADD_TO_PLAN",
        newFocus: false,
        query: {
          add: "1",
          source: "analysis",
          examId: EXAM,
          baselineMockExamId: "m1",
          subjectRef: "matematik",
          topicRef: "problemler",
          title: "Problemler tekrarı",
        },
      },
    });
  });

  it("starts the review once the focus is in the plan", () => {
    const analysis = { ...base, trend, nextFocus: focus, improvementCycle: cycle({}) };
    const view = buildFocusPath(analysis, EXAM, 5);
    expect(states(view)).toEqual(["done", "done", "current", "upcoming"]);
    expect(view).toMatchObject({
      cycleState: "planned",
      subjectName: "Tarih",
      message: "Tarih için plana bağlandın.",
      reviewed: { done: 3, total: 5 },
      plannedAt: "2026-09-12T08:00:00Z",
      cta: { kind: "REVIEW", count: 5, query: { review: "focus", examId: EXAM, subjectRef: "tarih" } },
    });
    expect(buildFocusPath(analysis, EXAM, null)).toMatchObject({ cta: { kind: "REVIEW", count: null } });
    expect(buildFocusPath(analysis, EXAM, 0)).toMatchObject({
      cta: { kind: "OPEN_NOTEBOOK", query: { panel: "index", examId: EXAM, subjectRef: "tarih" } },
    });
    expect(needsFocusDueCount(analysis)).toBe(true);
  });

  it("asks for the next exam once the review is done", () => {
    const analysis = { ...base, trend, improvementCycle: cycle({ practiced: true }) };
    const view = buildFocusPath(analysis, EXAM, null);
    expect(states(view)).toEqual(["done", "done", "done", "current"]);
    expect(view).toMatchObject({ cycleState: "practiced", cta: { kind: "NEW_EXAM" } });
    expect(needsFocusDueCount(analysis)).toBe(false);
  });

  it("keeps the review as the next step when an exam came before it", () => {
    const view = buildFocusPath(
      { ...base, trend, improvementCycle: cycle({ measured: true }) },
      EXAM,
      2,
    );
    expect(states(view)).toEqual(["done", "done", "current", "done"]);
    expect(view).toMatchObject({ cycleState: "measured", cta: { kind: "REVIEW", count: 2 } });
  });

  it("proposes the next focus after a closed loop and links the coach to the follow-up exam", () => {
    const view = buildFocusPath(
      { ...base, trend, nextFocus: focus, improvementCycle: cycle({ practiced: true, measured: true }) },
      EXAM,
      null,
    );
    expect(states(view)).toEqual(["done", "done", "done", "done"]);
    expect(view).toMatchObject({
      cycleState: "closed",
      followUpDelta: "+2.00",
      coachMockExamId: "m2",
      proposal: { subjectName: "Matematik", topicName: "Problemler" },
      cta: { kind: "ADD_TO_PLAN", newFocus: true, query: { subjectRef: "matematik" } },
    });
  });

  it("moves on when the baseline exam was deleted, without a coach link", () => {
    const view = buildFocusPath(
      { ...base, trend, nextFocus: focus, improvementCycle: cycle({ practiced: true }, { baseline: null }) },
      EXAM,
      null,
    );
    expect(states(view)).toEqual(["done", "done", "done", "upcoming"]);
    expect(view).toMatchObject({
      coachMockExamId: null,
      cta: { kind: "ADD_TO_PLAN", newFocus: true },
    });
  });

  it("asks for an exam when the proposal has no baseline exam to plan against", () => {
    const view = buildFocusPath(
      { ...base, trend, nextFocus: { ...focus, recentTrend: [] } },
      EXAM,
      null,
    );
    expect(view).toMatchObject({ cta: { kind: "NEW_EXAM" } });
  });
});
