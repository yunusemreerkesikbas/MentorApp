"use client";

import { useCallback, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import type {
  CoachingAnalysisDto,
  ExamSubjectDto,
  ExamSummaryDto,
  MockExamDto,
} from "@mentor/types";
import { http } from "@mentor/api-client";
import { useMentorToast } from "@/lib/mentor-toast";
import {
  emptyScores,
  paperSubjects,
  scoresFromMockExam,
  shouldRevealFirstInsight,
  type SubjectScores,
} from "./analysis-types";
import { errorMessage } from "./use-analysis-data";

const todayIso = () => new Date().toISOString().slice(0, 10);

/** The new mock exam form: its fields, the save, and what the student sees right after it. */
export function useMockExamEntry({
  exam,
  subjects,
  analysis,
  onSaved,
  onFirstInsight,
}: {
  exam: ExamSummaryDto | null;
  subjects: ExamSubjectDto[];
  analysis: CoachingAnalysisDto | null;
  onSaved: () => Promise<unknown>;
  onFirstInsight: () => void;
}) {
  const t = useTranslations("analysis");
  const toast = useMentorToast();
  const [scores, setScores] = useState<Record<string, SubjectScores>>(() =>
    emptyScores(subjects),
  );
  // Subjects arrive after the taxonomy loads; reset the rows then — during render, not in an effect.
  const [scoresFor, setScoresFor] = useState(subjects);
  if (scoresFor !== subjects) {
    setScoresFor(subjects);
    setScores(emptyScores(subjects));
  }
  const [publisherName, setPublisherName] = useState("");
  const [takenAtDate, setTakenAtDate] = useState(todayIso);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /**
   * Set right after a save that had wrong answers in it, while the count still means something:
   * the notebook is where those numbers become cards the student actually revisits.
   */
  const [notebookHandoff, setNotebookHandoff] = useState<{
    mockExamId: string;
    wrongTotal: number;
  } | null>(null);

  const updateScore = useCallback(
    (slug: string, field: keyof SubjectScores, value: string) => {
      setScores((prev) => ({ ...prev, [slug]: { ...prev[slug]!, [field]: value } }));
    },
    [],
  );

  const copyFrom = useCallback(
    (mock: MockExamDto) => {
      setScores(scoresFromMockExam(subjects, mock.subjects));
      setPublisherName(mock.publisherName ?? "");
      setTakenAtDate(mock.takenAt.slice(0, 10));
    },
    [subjects],
  );

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!exam || submitting) return;
    const revealFirstInsight = shouldRevealFirstInsight(analysis?.trend.length ?? 0);
    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        examId: exam.id,
        ...(publisherName.trim() ? { publisherName: publisherName.trim() } : {}),
        ...(takenAtDate
          ? { takenAt: new Date(`${takenAtDate}T12:00:00`).toISOString() }
          : {}),
        subjects: paperSubjects(subjects).map((subject) => ({
          subjectRef: subject.slug,
          correct: Number(scores[subject.slug]?.correct || 0),
          wrong: Number(scores[subject.slug]?.wrong || 0),
          blank: Number(scores[subject.slug]?.blank || 0),
        })),
      };
      const result = await http<MockExamDto>("/v1/mock-exams", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      toast.success({
        title: t("saved_toast_title"),
        message: t("saved_toast_message", { net: result.totalNet }),
      });
      const wrongTotal = payload.subjects.reduce((sum, subject) => sum + subject.wrong, 0);
      setNotebookHandoff(wrongTotal > 0 ? { mockExamId: result.id, wrongTotal } : null);
      await onSaved();
      setScores(emptyScores(subjects));
      setPublisherName("");
      setTakenAtDate(todayIso());
      if (revealFirstInsight) onFirstInsight();
    } catch (submitError) {
      setError(errorMessage(submitError));
    } finally {
      setSubmitting(false);
    }
  }

  return {
    scores,
    updateScore,
    publisherName,
    setPublisherName,
    takenAtDate,
    setTakenAtDate,
    submitting,
    error,
    notebookHandoff,
    dismissHandoff: () => setNotebookHandoff(null),
    copyFrom,
    submit,
  };
}
