import type { AnalysisFocusDto, CoachingAnalysisDto } from "@mentor/types";
import { analysisCycleView } from "@/lib/analysis-cycle-view";

export type FocusStepKey = "signal" | "planned" | "practiced" | "measured";
export type FocusStepState = "done" | "current" | "upcoming";
export type CycleState = "signal" | "planned" | "practiced" | "measured" | "closed";

export interface FocusStep {
  key: FocusStepKey;
  state: FocusStepState;
}

type Query = Record<string, string>;

/** The one ledge the hero offers, by where the loop stands (DESIGN.md §1 rule 1). */
export type FocusCta =
  | { kind: "ADD_TO_PLAN"; newFocus: boolean; query: Query }
  | { kind: "REVIEW"; count: number | null; query: Query }
  | { kind: "OPEN_NOTEBOOK"; query: Query }
  | { kind: "NEW_EXAM" };

export interface FocusView {
  kind: "focus";
  subjectName: string;
  topicName: string | null;
  source: AnalysisFocusDto["source"];
  evidenceCount: number;
  message: string | null;
  steps: FocusStep[];
  cta: FocusCta;
  /** Set when the loop is done or broken and the server proposes the next focus. */
  proposal: { subjectName: string; topicName: string | null } | null;
  coachMockExamId: string | null;
  cycleState: CycleState;
  /** Plan date, reviews and the follow-up difference for the node captions. */
  plannedAt: string | null;
  reviewed: { done: number; total: number } | null;
  followUpDelta: string | null;
}

export type FocusPathView = FocusView | { kind: "empty" } | null;

const STEP_KEYS: FocusStepKey[] = ["signal", "planned", "practiced", "measured"];

/**
 * The improvement loop as a path with one next step. Pure: every decision is the server's
 * (`improvementCycle`, `nextFocus`); this only picks which of them the student sees and where the
 * single ledge leads. `dueCount` is the focus' review count, `null` while it loads.
 */
export function buildFocusPath(
  analysis: CoachingAnalysisDto,
  examId: string,
  dueCount: number | null,
): FocusPathView {
  const { focus, coachMockExamId, proposal } = analysisCycleView(analysis);
  if (!focus) return analysis.trend.length === 0 ? { kind: "empty" } : null;

  const cycle = analysis.improvementCycle;
  const done: Record<FocusStepKey, boolean> = {
    signal: true,
    planned: Boolean(cycle),
    practiced: cycle?.steps.practiced ?? false,
    measured: cycle?.steps.measured ?? false,
  };
  const cycleState: CycleState = cycle?.steps.closed
    ? "closed"
    : cycle?.steps.measured
      ? "measured"
      : cycle?.steps.practiced
        ? "practiced"
        : cycle
          ? "planned"
          : "signal";

  const focusQuery: Query = {
    examId,
    subjectRef: focus.subjectRef,
    ...(focus.topicRef ? { topicRef: focus.topicRef } : {}),
  };

  let cta: FocusCta;
  if (proposal) {
    const baseline = proposal.recentTrend[0];
    cta = baseline
      ? {
          kind: "ADD_TO_PLAN",
          newFocus: Boolean(cycle),
          query: {
            add: "1",
            source: "analysis",
            examId,
            baselineMockExamId: baseline.mockExamId,
            subjectRef: proposal.subjectRef,
            ...(proposal.topicRef ? { topicRef: proposal.topicRef } : {}),
            subject: proposal.subjectName,
            ...(proposal.topicName ? { topic: proposal.topicName } : {}),
            title: proposal.suggestedTaskTitle,
          },
        }
      : { kind: "NEW_EXAM" };
  } else if (!done.practiced) {
    cta =
      dueCount === 0
        ? { kind: "OPEN_NOTEBOOK", query: { panel: "index", ...focusQuery } }
        : {
            kind: "REVIEW",
            count: dueCount,
            // `from` brings "Analize dön" back to Gelişim instead of Yanlışlarım.
            query: { review: "focus", from: "progress", ...focusQuery },
          };
  } else {
    cta = { kind: "NEW_EXAM" };
  }

  // A proposal after a started loop means the loop is done or broken: no node is "next" any more.
  const loopOver = cta.kind === "ADD_TO_PLAN" && cta.newFocus;
  const current = loopOver ? null : STEP_KEYS.find((key) => !done[key]) ?? null;
  const steps = STEP_KEYS.map((key) => ({
    key,
    state: key === current ? "current" : done[key] ? "done" : "upcoming",
  })) satisfies FocusStep[];

  return {
    kind: "focus",
    subjectName: focus.subjectName,
    topicName: focus.topicName ?? null,
    source: focus.source,
    evidenceCount: focus.evidenceCount,
    message: cycle?.message ?? analysis.nextFocus?.message ?? null,
    steps,
    cta,
    proposal:
      loopOver && proposal
        ? { subjectName: proposal.subjectName, topicName: proposal.topicName ?? null }
        : null,
    coachMockExamId: coachMockExamId ?? null,
    cycleState,
    plannedAt: cycle?.task.createdAt ?? null,
    reviewed:
      cycle && cycle.notebook.matchingCount > 0
        ? {
            done: Math.min(cycle.notebook.reviewedAfterPlanCount, cycle.notebook.matchingCount),
            total: cycle.notebook.matchingCount,
          }
        : null,
    followUpDelta: cycle?.followUp?.delta ?? null,
  };
}

/** Whether the hero needs the focus' due count (only the review step shows it). */
export function needsFocusDueCount(analysis: CoachingAnalysisDto): boolean {
  const cycle = analysis.improvementCycle;
  return Boolean(cycle && cycle.baseline && !cycle.steps.practiced);
}
