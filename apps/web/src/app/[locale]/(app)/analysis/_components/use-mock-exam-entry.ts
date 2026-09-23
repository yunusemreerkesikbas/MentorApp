"use client";

import { useCallback, useState, type FormEvent } from "react";
import type { ExamSubjectDto, ExamSummaryDto, MockExamDto } from "@mentor/types";
import { http } from "@mentor/api-client";
import {
  emptyScores,
  paperSubjects,
  scoresFromMockExam,
  type SubjectScores,
} from "./analysis-types";
import { errorMessage } from "./use-analysis-data";

// Local calendar day: toISOString() is UTC and shows yesterday before 03:00 in Istanbul.
const todayIso = () => {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
};

/** The exam as it was sent, with the server's net: what the saved moment speaks about. */
export interface SavedMockExam {
  id: string;
  totalNet: string;
  publisherName: string | null;
  takenAt: string;
  wrongTotal: number;
}

export type MockExamEntry = ReturnType<typeof useMockExamEntry>;

/** The new mock exam form: its fields, the save, and the saved moment right after it. */
export function useMockExamEntry({
  exam,
  subjects,
  onSaved,
}: {
  exam: ExamSummaryDto | null;
  subjects: ExamSubjectDto[];
  onSaved: () => Promise<unknown>;
}) {
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
  const [saved, setSaved] = useState<SavedMockExam | null>(null);

  const updateScore = useCallback((slug: string, row: SubjectScores) => {
    setScores((prev) => ({ ...prev, [slug]: row }));
  }, []);

  const copyFrom = useCallback(
    (mock: MockExamDto) => {
      setScores(scoresFromMockExam(subjects, mock.subjects));
      setPublisherName(mock.publisherName ?? "");
      setTakenAtDate(mock.takenAt.slice(0, 10));
    },
    [subjects],
  );

  const clearSaved = useCallback(() => setSaved(null), []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!exam || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const publisher = publisherName.trim() || null;
      const takenAt = new Date(`${takenAtDate}T12:00:00`).toISOString();
      const rows = paperSubjects(subjects).map((subject) => ({
        subjectRef: subject.slug,
        correct: Number(scores[subject.slug]?.correct || 0),
        wrong: Number(scores[subject.slug]?.wrong || 0),
        blank: Number(scores[subject.slug]?.blank || 0),
      }));
      const result = await http<MockExamDto>("/v1/mock-exams", {
        method: "POST",
        body: JSON.stringify({
          examId: exam.id,
          ...(publisher ? { publisherName: publisher } : {}),
          takenAt,
          subjects: rows,
        }),
      });
      // The exam is saved even if the refresh fails; the saved moment then says only what it knows.
      await onSaved().catch(() => undefined);
      setSaved({
        id: result.id,
        totalNet: result.totalNet,
        publisherName: publisher,
        takenAt,
        wrongTotal: rows.reduce((sum, row) => sum + row.wrong, 0),
      });
      setScores(emptyScores(subjects));
      setPublisherName("");
      setTakenAtDate(todayIso());
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
    saved,
    clearSaved,
    copyFrom,
    submit,
  };
}
