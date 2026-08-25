import type {
  StudyRoomDetailDto,
  StudyRoomDto,
  StudyRoomTheme,
} from "@mentor/types";
import { http } from "@mentor/api-client";

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
