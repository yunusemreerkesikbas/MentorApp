import { ApiClientError, http } from "@mentor/api-client";
import {
  classifyStudyRoomJoinErrorCode,
  normalizeStudyRoomCode,
  type StudyRoomJoinFailure,
} from "@mentor/core";
import type {
  CommentView,
  CommunitySummary,
  LeaderboardView,
  LeaderboardWindow,
  Paginated,
  StudyRoomDetailDto,
  StudyRoomDto,
  StudyRoomTheme,
  ThreadDetail,
  ThreadFeed,
  ThreadView,
  ZoneView,
} from "@mentor/types";

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

export async function listForumZones(): Promise<ZoneView[]> {
  const page = await http<Paginated<ZoneView>>("/v1/forum/zones?pageSize=50");
  return page?.items ?? [];
}

export async function listZoneThreads(zoneId: string): Promise<ThreadView[]> {
  const feed = await http<ThreadFeed>(
    `/v1/forum/zones/${encodeURIComponent(zoneId)}/threads?limit=25`,
  );
  return feed?.items ?? [];
}

export async function postZoneThread(input: {
  zoneId: string;
  body: string;
  title?: string;
}): Promise<ThreadView> {
  return (await http<ThreadView>(
    `/v1/forum/zones/${encodeURIComponent(input.zoneId)}/threads`,
    {
      method: "POST",
      body: JSON.stringify({
        body: input.body.trim(),
        ...(input.title?.trim() ? { title: input.title.trim() } : {}),
      }),
    },
  )) as ThreadView;
}

export async function getThreadDetail(threadId: string): Promise<ThreadDetail> {
  return (await http<ThreadDetail>(
    `/v1/forum/threads/${encodeURIComponent(threadId)}/detail`,
  )) as ThreadDetail;
}

export async function postThreadComment(input: {
  threadId: string;
  body: string;
}): Promise<CommentView> {
  return (await http<CommentView>(
    `/v1/forum/threads/${encodeURIComponent(input.threadId)}/comments`,
    {
      method: "POST",
      body: JSON.stringify({ body: input.body.trim() }),
    },
  )) as CommentView;
}

export async function toggleThreadReaction(input: {
  threadId: string;
  emoji: string;
  active: boolean;
}): Promise<void> {
  await http(`/v1/forum/threads/${encodeURIComponent(input.threadId)}/reactions`, {
    method: input.active ? "DELETE" : "PUT",
    body: JSON.stringify({ emoji: input.emoji }),
  });
}

export async function fetchCommunitySummary(): Promise<CommunitySummary> {
  return (await http<CommunitySummary>(
    "/v1/community/summary",
  )) as CommunitySummary;
}

export async function fetchCommunityLeaderboard(
  window: LeaderboardWindow = "weekly",
): Promise<LeaderboardView> {
  return (await http<LeaderboardView>(
    `/v1/community/leaderboard?window=${window}`,
  )) as LeaderboardView;
}
