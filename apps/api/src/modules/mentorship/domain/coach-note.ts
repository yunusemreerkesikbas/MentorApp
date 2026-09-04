import type { MentorshipCoachNoteDto } from "@mentor/types";

/**
 * The link row's two note columns as one DTO, or null.
 *
 * They are written together and read together, so the pairing lives in one place rather than in
 * every mapper: a body with no timestamp (or the reverse) is not a state the API should be able
 * to express by accident.
 */
export function toCoachNoteDto(link: {
  coachNote?: string | null;
  coachNoteAt?: Date | null;
}): MentorshipCoachNoteDto | null {
  // Nullish rather than `=== null`, and both halves must be present: a body without a timestamp
  // is a half-written row, and rendering "note left on <nothing>" is worse than rendering none.
  // An empty body is no note either, which is also what the schema's transform produces.
  const body = link.coachNote ?? null;
  const at = link.coachNoteAt ?? null;
  if (body === null || body === "" || at === null) return null;
  return { body, updatedAt: at.toISOString() };
}
