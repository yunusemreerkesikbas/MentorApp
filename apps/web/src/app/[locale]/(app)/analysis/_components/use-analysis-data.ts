"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { CoachingAnalysisDto, ExamSubjectDto, ExamSummaryDto } from "@mentor/types";
import { ApiClientError, http } from "@mentor/api-client";
import { loadViewerExamTaxonomy } from "@/lib/exam-taxonomy";

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "needs_exam_type" }
  | {
      status: "ready";
      exam: ExamSummaryDto | null;
      subjects: ExamSubjectDto[];
      analysis: CoachingAnalysisDto | null;
    };

const NO_SUBJECTS: ExamSubjectDto[] = [];

function analysisUrl(examId: string): string {
  return `/v1/coaching/analysis?${new URLSearchParams({ examId }).toString()}`;
}

export function errorMessage(error: unknown): string {
  return error instanceof ApiClientError || error instanceof Error
    ? error.message
    : String(error);
}

/**
 * The viewer's exam, its subjects and the server-computed analysis. The taxonomy decides which exam
 * the analysis is for, so the two calls are one chain; everything else on the page loads on its own.
 */
export function useAnalysisData() {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const bundle = await loadViewerExamTaxonomy();
        if (!active) return;
        if (bundle.needsExamType) {
          setState({ status: "needs_exam_type" });
          return;
        }
        const analysis = bundle.exam
          ? await http<CoachingAnalysisDto>(analysisUrl(bundle.exam.id))
          : null;
        if (!active) return;
        setState({
          status: "ready",
          exam: bundle.exam,
          subjects: bundle.subjects,
          analysis,
        });
      } catch (loadError) {
        if (active) setState({ status: "error", message: errorMessage(loadError) });
      }
    })();
    return () => {
      active = false;
    };
  }, [attempt]);

  const ready = state.status === "ready" ? state : null;
  const exam = ready?.exam ?? null;
  const subjects = ready?.subjects ?? NO_SUBJECTS;
  const analysis = ready?.analysis ?? null;
  const examId = exam?.id ?? null;

  /** Re-reads the analysis after a save, edit or delete; the taxonomy does not change underneath. */
  const refresh = useCallback(async () => {
    if (!examId) return null;
    const next = await http<CoachingAnalysisDto>(analysisUrl(examId));
    setState((current) =>
      current.status === "ready" && current.exam?.id === examId
        ? { ...current, analysis: next }
        : current,
    );
    return next;
  }, [examId]);

  const retry = useCallback(() => {
    setState({ status: "loading" });
    setAttempt((value) => value + 1);
  }, []);

  return useMemo(
    () => ({ state, exam, subjects, analysis, refresh, retry }),
    [state, exam, subjects, analysis, refresh, retry],
  );
}
