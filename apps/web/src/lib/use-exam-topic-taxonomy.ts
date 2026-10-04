"use client";

import { useEffect, useState } from "react";
import type { ExamSubjectDto, ExamTopicDto } from "@mentor/types";
import {
  groupTopicsBySubjectName,
  loadExamTaxonomyForTrack,
} from "./exam-taxonomy";

export interface ExamTopicTaxonomyState {
  /** Subject display names in taxonomy order — what goes into `plan_tasks.subject`. */
  subjects: string[];
  /** Topic display names per subject display name — what goes into `plan_tasks.topic`. */
  topicsBySubject: Map<string, string[]>;
  subjectRows: ExamSubjectDto[];
  topicRows: ExamTopicDto[];
  loaded: boolean;
}

const EMPTY: ExamTopicTaxonomyState = {
  subjects: [],
  topicsBySubject: new Map(),
  subjectRows: [],
  topicRows: [],
  loaded: true,
};

/**
 * Topic taxonomy for ONE student's exam track. Pass null while the report is still loading.
 */
export function useExamTopicTaxonomy(examType: string | null): ExamTopicTaxonomyState {
  const [entry, setEntry] = useState<{
    key: string | null;
    state: ExamTopicTaxonomyState;
  }>(() => ({
    key: examType,
    state: examType ? { ...EMPTY, loaded: false } : EMPTY,
  }));

  useEffect(() => {
    let active = true;
    void loadExamTaxonomyForTrack(examType)
      .then((bundle) => {
        if (!active) return;
        if (bundle.needsExamType || !bundle.exam) {
          setEntry({ key: examType, state: EMPTY });
          return;
        }
        setEntry({
          key: examType,
          state: {
            ...groupTopicsBySubjectName(bundle.topics),
            subjectRows: bundle.subjects,
            topicRows: bundle.topics,
            loaded: true,
          },
        });
      })
      .catch(() => {
        if (active) setEntry({ key: examType, state: EMPTY });
      });
    return () => {
      active = false;
    };
  }, [examType]);

  return entry.key === examType ? entry.state : { ...EMPTY, loaded: false };
}
