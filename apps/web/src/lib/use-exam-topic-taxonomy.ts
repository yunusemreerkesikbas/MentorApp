"use client";

import { useEffect, useState } from "react";
import type { ExamCalendarDto, ExamTopicDto } from "@mentor/types";
import { contentControllerCalendarByFamily } from "@mentor/api-client";
import { fetchExamTopics } from "./content-topics";

export interface ExamTopicTaxonomyState {
  /** Subject display names in taxonomy order — what goes into `plan_tasks.subject`. */
  subjects: string[];
  /** Topic display names per subject display name — what goes into `plan_tasks.topic`. */
  topicsBySubject: Map<string, string[]>;
  loaded: boolean;
}

const EMPTY: ExamTopicTaxonomyState = {
  subjects: [],
  topicsBySubject: new Map(),
  loaded: true,
};

/**
 * Session cache keyed by exam family. A coach may hold students on different tracks, so unlike
 * {@link useExamSubjectTaxonomy} — which reads the VIEWER's own exam — one cached answer is not
 * enough, and reading the viewer's exam would be the wrong question entirely.
 */
const cache = new Map<string, ExamTopicTaxonomyState>();
const inflight = new Map<string, Promise<ExamTopicTaxonomyState>>();

async function load(examType: string): Promise<ExamTopicTaxonomyState> {
  const calendar = (await contentControllerCalendarByFamily(
    examType,
  )) as unknown as ExamCalendarDto | null;
  const slug = calendar?.exam?.slug;
  if (!slug) return EMPTY;

  const rows: ExamTopicDto[] = await fetchExamTopics(slug);
  // One fetch, both lists: ExamTopicDto already carries its subject, so asking for subjects
  // separately would be a second round trip for data we are holding.
  const bySubject = new Map<string, string[]>();
  for (const row of [...rows].sort((a, b) => a.sortOrder - b.sortOrder)) {
    const list = bySubject.get(row.subjectName);
    if (list) list.push(row.name);
    else bySubject.set(row.subjectName, [row.name]);
  }
  return { subjects: [...bySubject.keys()], topicsBySubject: bySubject, loaded: true };
}

/**
 * The topic taxonomy for ONE student's exam track (`MentorshipStudentReportDto.studentExamType`,
 * scope key `EXAM_TRACK`). Pass null while the report is still loading, or when the student never
 * set an exam — the coach then simply gets no picker.
 */
export function useExamTopicTaxonomy(examType: string | null): ExamTopicTaxonomyState {
  // The exam is stored WITH its answer, so switching students never shows the previous student's
  // topics for a render: a stale key simply reads as "not loaded yet".
  const [entry, setEntry] = useState<{ key: string | null; state: ExamTopicTaxonomyState }>(() => ({
    key: examType,
    state: (examType ? cache.get(examType) : EMPTY) ?? { ...EMPTY, loaded: false },
  }));

  useEffect(() => {
    let active = true;

    // One path for every case (no exam / cached / in-flight / cold). A synchronous set here would
    // cascade an extra render, so even the trivial answers go through a resolved promise.
    let run: Promise<ExamTopicTaxonomyState>;
    const cached = examType ? cache.get(examType) : EMPTY;
    if (cached) {
      run = Promise.resolve(cached);
    } else {
      const key = examType!;
      const started = inflight.get(key) ?? load(key);
      if (!inflight.has(key)) {
        inflight.set(
          key,
          started.finally(() => inflight.delete(key)),
        );
      }
      run = started;
    }

    void run
      .then((result) => {
        if (examType) cache.set(examType, result);
        if (active) setEntry({ key: examType, state: result });
      })
      .catch(() => {
        // No picker beats a wrong picker: an empty taxonomy leaves the coach typing a free label,
        // which is exactly what `subject`/`topic` are — soft refs, not foreign keys.
        if (examType) cache.set(examType, EMPTY);
        if (active) setEntry({ key: examType, state: EMPTY });
      });

    return () => {
      active = false;
    };
  }, [examType]);

  return entry.key === examType ? entry.state : { ...EMPTY, loaded: false };
}
