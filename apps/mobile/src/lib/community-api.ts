import { ApiClientError, http } from "@mentor/api-client";
import {
  classifyStudyRoomJoinErrorCode,
  normalizeStudyRoomCode,
  type StudyRoomJoinFailure,
} from "@mentor/core";
import type {
  AchievementCollectionDto,
  CommunitySummary,
  LeaderboardView,
  LeaderboardWindow,
  PublicProfile,
  StudyRoomDetailDto,
  StudyRoomDto,
  StudyRoomTheme,
} from "@mentor/types";
import { fetchTodayPanel } from "./coaching-api.js";

export async function listStudyRooms(): Promise<StudyRoomDto[]> {
  return (await http<StudyRoomDto[]>("/v1/study-rooms")) ?? [];
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

export async function joinStudyRoom(code: string): Promise<StudyRoomDetailDto> {
  return (await http<StudyRoomDetailDto>("/v1/study-rooms/join", {
    method: "POST",
    body: JSON.stringify({ code: normalizeStudyRoomCode(code) }),
  })) as StudyRoomDetailDto;
}

export function mapStudyRoomJoinError(err: unknown): StudyRoomJoinFailure {
  const code = err instanceof ApiClientError ? err.body.code : null;
  return classifyStudyRoomJoinErrorCode(code);
}

export async function rotateStudyRoomCode(id: string): Promise<StudyRoomDetailDto> {
  return (await http<StudyRoomDetailDto>(
    `/v1/study-rooms/${encodeURIComponent(id)}/code`,
    { method: "POST" },
  )) as StudyRoomDetailDto;
}

export async function leaveStudyRoom(id: string): Promise<void> {
  await http(`/v1/study-rooms/${encodeURIComponent(id)}/members/me`, {
    method: "DELETE",
  });
}

export async function closeStudyRoom(id: string): Promise<void> {
  await http(`/v1/study-rooms/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

export async function fetchCommunitySummary(): Promise<CommunitySummary> {
  return (await http<CommunitySummary>("/v1/community/summary")) as CommunitySummary;
}

export async function fetchCommunityLeaderboard(
  window: LeaderboardWindow = "weekly",
): Promise<LeaderboardView> {
  return (await http<LeaderboardView>(
    `/v1/community/leaderboard?window=${window}`,
  )) as LeaderboardView;
}

export async function fetchPublicProfile(username: string): Promise<PublicProfile> {
  return (await http<PublicProfile>(
    `/v1/community/profile/${encodeURIComponent(username)}`,
  )) as PublicProfile;
}

export async function fetchProfileAchievements(
  username: string,
): Promise<AchievementCollectionDto> {
  return (await http<AchievementCollectionDto>(
    `/v1/community/profile/${encodeURIComponent(username)}/achievements`,
  )) as AchievementCollectionDto;
}

export async function followUser(username: string): Promise<void> {
  await http<void>(`/v1/users/${encodeURIComponent(username)}/follow`, {
    method: "PUT",
  });
}

export async function unfollowUser(username: string): Promise<void> {
  await http<void>(`/v1/users/${encodeURIComponent(username)}/follow`, {
    method: "DELETE",
  });
}

/** Live study count from `/v1/coaching/today` (same source as web community hub). */
export async function fetchFocusingNow(): Promise<number | null> {
  try {
    const today = await fetchTodayPanel();
    const count = today.focusingNow;
    return typeof count === "number" && count > 0 ? count : null;
  } catch {
    return null;
  }
}
