import type { StudySessionDto } from "@mentor/types";
import { studySessionControllerFinalize, studySessionControllerStart } from "@mentor/api-client";

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
): Promise<void> {
  await studySessionControllerFinalize(id, input);
}
