import type { ExamTopicDto } from "@mentor/types";
import { http } from "@mentor/api-client";

/**
 * The exam's topic taxonomy. Public reference data — no auth scoping, no user data.
 *
 * A hand-written call rather than a generated client method: the endpoint is newer than the last
 * orval run, and one `http` line is cheaper than regenerating the whole client for it.
 * ponytail: folds into `@mentor/api-client` at the next regeneration.
 */
export async function fetchExamTopics(examSlug: string): Promise<ExamTopicDto[]> {
  return (await http<ExamTopicDto[]>(
    `/v1/exams/${encodeURIComponent(examSlug)}/topics`,
  )) as ExamTopicDto[];
}
