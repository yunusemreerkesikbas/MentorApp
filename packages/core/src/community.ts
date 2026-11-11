export const STUDY_ROOM_THEMES = ["LIBRARY", "CAFE", "HOME"] as const;
export const STUDY_ROOM_CAPACITIES = [4, 6, 8, 10] as const;

export type StudyRoomJoinFailure =
  | "already_member"
  | "invalid"
  | "malformed"
  | "full"
  | "quota"
  | "error";

/**
 * Maps an API error code from `POST /v1/study-rooms/join` to a deterministic UI failure key
 * shared across web and mobile surfaces.
 */
export function classifyStudyRoomJoinErrorCode(
  code: string | null | undefined,
): StudyRoomJoinFailure {
  if (code === "COACHING_ROOM_ALREADY_MEMBER") return "already_member";
  if (code === "COACHING_ROOM_CODE_INVALID" || code === "COACHING_ROOM_NOT_FOUND") {
    return "invalid";
  }
  if (code === "VALIDATION_ERROR") return "malformed";
  if (code === "COACHING_ROOM_FULL") return "full";
  if (code === "COACHING_ROOM_QUOTA_EXCEEDED") return "quota";
  return "error";
}

/**
 * Normalizes a human-typed study room invite code (e.g. `masa-ab12cd` -> `MASA-AB12CD`).
 */
export function normalizeStudyRoomCode(raw: string): string {
  return raw.trim().toUpperCase();
}
