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

type TaxonomyCache = {
  subjects: ExamSubjectDto[];
  needsExamType: boolean;
};

/** Session-scoped cache so plan + session pickers share one fetch. */
let taxonomyCache: TaxonomyCache | null = null;
let taxonomyInflight: Promise<TaxonomyCache> | null = null;

async function loadTaxonomy(): Promise<TaxonomyCache> {
  const me = (await usersControllerMe()) as unknown as AuthUser;
  if (!me.examType) {
    return { subjects: [], needsExamType: true };
  }
  const calendar = (await contentControllerCalendarByFamily(
    me.examType,
  )) as unknown as ExamCalendarDto | null;
  const exam = calendar?.exam ?? null;
  if (!exam) {
    return { subjects: [], needsExamType: false };
  }
  const rows = (await contentControllerSubjectsBySlug(
    exam.slug,
  )) as unknown as ExamSubjectDto[];
  return { subjects: rows, needsExamType: false };
}

/** Loads exam subject taxonomy for the current user (plan + study-session subject pickers). */
export function useExamSubjectTaxonomy(): ExamSubjectTaxonomyState {
  const [subjects, setSubjects] = useState<ExamSubjectDto[]>(
    () => taxonomyCache?.subjects ?? [],
  );
  const [needsExamType, setNeedsExamType] = useState(
    () => taxonomyCache?.needsExamType ?? false,
  );
  const [loaded, setLoaded] = useState(() => taxonomyCache !== null);

  useEffect(() => {
    let active = true;

    // One path for all three cases (cached / in-flight / cold). A cache hit resolves immediately,
    // so state lands asynchronously — a synchronous set here would cascade an extra render.
    let run: Promise<TaxonomyCache>;
    if (taxonomyCache) {
      run = Promise.resolve(taxonomyCache);
    } else if (taxonomyInflight) {
      run = taxonomyInflight;
    } else {
      run = loadTaxonomy();
      taxonomyInflight = run.finally(() => {
        taxonomyInflight = null;
      });
    }

    void run
      .then((result) => {
        taxonomyCache = result;
        if (!active) return;
        setSubjects(result.subjects);
        setNeedsExamType(result.needsExamType);
        setLoaded(true);
      })
      .catch(() => {
        const fallback = { subjects: [], needsExamType: false };
        taxonomyCache = fallback;
        if (!active) return;
        setSubjects(fallback.subjects);
        setNeedsExamType(fallback.needsExamType);
        setLoaded(true);
      });

    return () => {
      active = false;
    };
  }, []);

  return { subjects, needsExamType, loaded };
}
