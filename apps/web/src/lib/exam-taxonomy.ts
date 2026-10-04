import type { ExamSubjectDto, ExamTopicDto } from "@mentor/types";
import {
  contentControllerCurrentExamByFamily,
  contentControllerSubjectsBySlug,
  contentControllerTopicsBySlug,
  usersControllerMe,
} from "@mentor/api-client";
import type { AuthUser, ExamSummaryDto } from "@mentor/types";

export interface ExamTaxonomyBundle {
  exam: ExamSummaryDto | null;
  subjects: ExamSubjectDto[];
  topics: ExamTopicDto[];
  needsExamType: boolean;
}

export interface NamedTopicTaxonomy {
  subjects: string[];
  topicsBySubject: Map<string, string[]>;
}

const EMPTY_BUNDLE: ExamTaxonomyBundle = {
  exam: null,
  subjects: [],
  topics: [],
  needsExamType: false,
};

const cache = new Map<string, ExamTaxonomyBundle>();
const inflight = new Map<string, Promise<ExamTaxonomyBundle>>();

function trackKey(examType: string, examVariant?: string | null): string {
  return `${examType}:${examVariant ?? ""}`;
}

export function groupTopicsBySubjectName(
  topics: ExamTopicDto[],
): NamedTopicTaxonomy {
  const bySubject = new Map<string, string[]>();
  for (const row of [...topics].sort((a, b) => a.sortOrder - b.sortOrder)) {
    const list = bySubject.get(row.subjectName);
    if (list) list.push(row.name);
    else bySubject.set(row.subjectName, [row.name]);
  }
  return { subjects: [...bySubject.keys()], topicsBySubject: bySubject };
}

export async function resolveCurrentExam(
  examType: string,
  examVariant?: string | null,
): Promise<ExamSummaryDto> {
  return contentControllerCurrentExamByFamily(examType, examVariant);
}

export async function loadExamTaxonomyBySlug(slug: string): Promise<{
  subjects: ExamSubjectDto[];
  topics: ExamTopicDto[];
}> {
  const [subjects, topics] = await Promise.all([
    contentControllerSubjectsBySlug(slug) as unknown as Promise<ExamSubjectDto[]>,
    contentControllerTopicsBySlug(slug) as unknown as Promise<ExamTopicDto[]>,
  ]);
  return { subjects, topics };
}

export async function loadExamTaxonomyForTrack(
  examType: string | null,
  examVariant?: string | null,
): Promise<ExamTaxonomyBundle> {
  if (!examType) {
    return { ...EMPTY_BUNDLE, needsExamType: true };
  }

  const key = trackKey(examType, examVariant);
  const cached = cache.get(key);
  if (cached) return cached;

  const started =
    inflight.get(key) ??
    (async () => {
      const exam = await resolveCurrentExam(examType, examVariant);
      const { subjects, topics } = await loadExamTaxonomyBySlug(exam.slug);
      return { exam, subjects, topics, needsExamType: false };
    })().finally(() => {
      inflight.delete(key);
    });

  if (!inflight.has(key)) inflight.set(key, started);

  try {
    const result = await started;
    cache.set(key, result);
    return result;
  } catch {
    cache.set(key, EMPTY_BUNDLE);
    return EMPTY_BUNDLE;
  }
}

export async function loadViewerExamTaxonomy(): Promise<ExamTaxonomyBundle> {
  const me = (await usersControllerMe()) as unknown as AuthUser;
  return loadExamTaxonomyForTrack(me.examType, me.examVariant);
}
