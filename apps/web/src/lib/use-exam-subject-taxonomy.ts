"use client";

import { useEffect, useState } from "react";
import type { AuthUser, ExamCalendarDto, ExamSubjectDto } from "@mentor/types";
import {
  contentControllerCalendarByFamily,
  contentControllerSubjectsBySlug,
  usersControllerMe,
} from "@mentor/api-client";

export interface ExamSubjectTaxonomyState {
  subjects: ExamSubjectDto[];
  needsExamType: boolean;
  loaded: boolean;
}

/** Loads exam subject taxonomy for the current user (plan + seans subject pickers). */
export function useExamSubjectTaxonomy(): ExamSubjectTaxonomyState {
  const [subjects, setSubjects] = useState<ExamSubjectDto[]>([]);
  const [needsExamType, setNeedsExamType] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const me = (await usersControllerMe()) as unknown as AuthUser;
        if (!active) return;
        if (!me.examType) {
          setNeedsExamType(true);
          setLoaded(true);
          return;
        }
        const calendar = (await contentControllerCalendarByFamily(
          me.examType,
        )) as unknown as ExamCalendarDto | null;
        const exam = calendar?.exam ?? null;
        if (!active) return;
        if (!exam) {
          setLoaded(true);
          return;
        }
        const rows = (await contentControllerSubjectsBySlug(
          exam.slug,
        )) as unknown as ExamSubjectDto[];
        if (!active) return;
        setSubjects(rows);
        setLoaded(true);
      } catch {
        if (!active) return;
        setLoaded(true);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, []);

  return { subjects, needsExamType, loaded };
}
