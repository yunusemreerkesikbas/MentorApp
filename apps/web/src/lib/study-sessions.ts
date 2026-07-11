import type { Paginated, StudySessionDto } from "@mentor/types";
import {
  getStudySessionControllerListUrl,
  http,
  studySessionControllerFinalize,
  studySessionControllerRecordFeedback,
  studySessionControllerStart,
} from "@mentor/api-client";

/**
 * Typed wrappers over the generated study-session client.
 *
 * The API DTOs are `type` aliases, so Nest/Swagger emits no response schema and the orval-generated
 * client types every response body as `void`. Until the API annotates response classes (backlog:
 * Swagger response types API-wide), we assert the known DTO shape here — in one place — so the
 * components stay cast-free. Mirrors the `plan-tasks.ts` wrapper pattern.
 */
export async function startStudySession(
  input: Parameters<typeof studySessionControllerStart>[0],
): Promise<StudySessionDto> {
  return (await studySessionControllerStart(input)) as unknown as StudySessionDto;
}

export async function finalizeStudySession(
  id: string,
  input: Parameters<typeof studySessionControllerFinalize>[1],
): Promise<StudySessionDto> {
  return (await studySessionControllerFinalize(id, input)) as unknown as StudySessionDto;
}

/** Attach the post-session micro check-in (mood 1-3 + optional note) to a finalized session. */
export async function recordSessionFeedback(
  id: string,
  input: Parameters<typeof studySessionControllerRecordFeedback>[1],
): Promise<void> {
  await studySessionControllerRecordFeedback(id, input);
}

/** Recent finalized sessions — generated client omits pagination query params. */
export async function listStudySessions(
  page = 1,
  pageSize = 5,
  subject?: string,
  from?: string,
  to?: string,
): Promise<Paginated<StudySessionDto>> {
  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
  });
  if (subject?.trim()) params.set("subject", subject.trim());
  if (from?.trim()) params.set("from", from.trim());
  if (to?.trim()) params.set("to", to.trim());
  const url = `${getStudySessionControllerListUrl()}?${params.toString()}`;
  return (await http<Paginated<StudySessionDto>>(url)) as Paginated<StudySessionDto>;
}
