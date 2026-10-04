import type {
  StudyRoomDetailDto,
  StudyRoomDto,
  StudyRoomTheme,
} from "@mentor/types";
import { ApiClientError, http } from "@mentor/api-client";

/**
 * Typed wrappers over the study-room surface (`/v1/study-rooms`) — persistent, themed,
 * invite-code tables for co-working. Hand-written `http` calls, mirroring lib/buddy.ts
 * (no orval coupling; the generated client has no response schemas for these DTOs).
 */

export async function listStudyRooms(): Promise<StudyRoomDto[]> {
  return (await http<StudyRoomDto[]>("/v1/study-rooms")) as StudyRoomDto[];
}

export async function getStudyRoom(id: string): Promise<StudyRoomDetailDto> {
  return (await http<StudyRoomDetailDto>(
    `/v1/study-rooms/${encodeURIComponent(id)}`,
  )) as StudyRoomDetailDto;
}

export async function createStudyRoom(input: {
  name: string;
  theme: StudyRoomTheme;
  capacity: number;
}): Promise<StudyRoomDetailDto> {
  return (await http<StudyRoomDetailDto>("/v1/study-rooms", {
    method: "POST",
    body: JSON.stringify(input),
  })) as StudyRoomDetailDto;
}

export type StudyRoomJoinFailure =
  | "already_member"
  | "invalid"
  | "malformed"
  | "full"
  | "quota"
  | "error";

/**
 * Why a join failed, in the words both join surfaces use (the join sheet and `/masaya-katil`).
 * An unknown code and a closed room read the same to the person holding the code: ask for a
 * new link. A bad shape, a full table, and the membership cap each say what happened. A
 * dropped connection is the only case worth a plain retry.
 */
export function studyRoomJoinFailure(err: unknown): StudyRoomJoinFailure {
  const code = err instanceof ApiClientError ? err.body.code : null;
  if (code === "COACHING_ROOM_ALREADY_MEMBER") return "already_member";
  if (code === "COACHING_ROOM_CODE_INVALID" || code === "COACHING_ROOM_NOT_FOUND") return "invalid";
  if (code === "VALIDATION_ERROR") return "malformed";
  if (code === "COACHING_ROOM_FULL") return "full";
  if (code === "COACHING_ROOM_QUOTA_EXCEEDED") return "quota";
  return "error";
}

/** Join by invite code. The API upper-cases and validates the `MASA-XXXXXX` shape. */
export async function joinStudyRoom(code: string): Promise<StudyRoomDetailDto> {
  return (await http<StudyRoomDetailDto>("/v1/study-rooms/join", {
    method: "POST",
    body: JSON.stringify({ code }),
  })) as StudyRoomDetailDto;
}

export async function updateStudyRoom(
  id: string,
  patch: { name?: string; theme?: StudyRoomTheme; capacity?: number },
): Promise<StudyRoomDetailDto> {
  return (await http<StudyRoomDetailDto>(`/v1/study-rooms/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  })) as StudyRoomDetailDto;
}

/** Rotate a leaked code (owner). Memberships are unaffected. */
export async function rotateStudyRoomCode(id: string): Promise<StudyRoomDetailDto> {
  return (await http<StudyRoomDetailDto>(
    `/v1/study-rooms/${encodeURIComponent(id)}/code`,
    { method: "POST" },
  )) as StudyRoomDetailDto;
}

export async function leaveStudyRoom(id: string): Promise<void> {
  await http(`/v1/study-rooms/${encodeURIComponent(id)}/members/me`, { method: "DELETE" });
}

export async function removeStudyRoomMember(id: string, userId: string): Promise<void> {
  await http(
    `/v1/study-rooms/${encodeURIComponent(id)}/members/${encodeURIComponent(userId)}`,
    { method: "DELETE" },
  );
}

export async function closeStudyRoom(id: string): Promise<void> {
  await http(`/v1/study-rooms/${encodeURIComponent(id)}`, { method: "DELETE" });
}
