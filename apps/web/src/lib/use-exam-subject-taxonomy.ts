"use client";

import { useEffect, useState } from "react";
import type { ExamSubjectDto } from "@mentor/types";
import { loadViewerExamTaxonomy } from "./exam-taxonomy";

export interface ExamSubjectTaxonomyState {
  subjects: ExamSubjectDto[];
  needsExamType: boolean;
  loaded: boolean;
}

/**
 * Subject list for the signed-in viewer's exam track (plan + study-session chips).
 */
export function useExamSubjectTaxonomy(): ExamSubjectTaxonomyState {
  const [subjects, setSubjects] = useState<ExamSubjectDto[]>([]);
  const [needsExamType, setNeedsExamType] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    void loadViewerExamTaxonomy()
      .then((result) => {
        if (!active) return;
        setSubjects(result.subjects);
        setNeedsExamType(result.needsExamType);
        setLoaded(true);
      })
      .catch(() => {
        if (!active) return;
        setSubjects([]);
        setNeedsExamType(false);
        setLoaded(true);
      });
    return () => {
      active = false;
    };
  }, []);

  return { subjects, needsExamType, loaded };
}
