import type {
  AnswerView,
  ModerationTargetType,
  Paginated,
  QuestionDetail,
  ReportReason,
  ThreadFeed,
  ThreadView,
  ZoneMemberStatus,
  ZoneView,
} from "@mentor/types";
import { ApiClientError, http } from "@mentor/api-client";

/**
 * Typed wrappers over the forum endpoints (mirrors lib/economy.ts / lib/coach.ts). Shapes are
 * asserted here in one place; regen api-client when OpenAPI updates. The whole surface is gated by
 * `forum.enabled` — a disabled feature answers 404 FORUM_DISABLED (see `isForumDisabled`).
 */

export async function listZones(): Promise<Paginated<ZoneView>> {
  return (await http<Paginated<ZoneView>>("/v1/forum/zones?pageSize=100")) as Paginated<ZoneView>;
}

export async function getZone(slug: string): Promise<ZoneView> {
  return (await http<ZoneView>(`/v1/forum/zones/${slug}`)) as ZoneView;
}

export async function joinZone(zoneId: string): Promise<{ status: ZoneMemberStatus }> {
  return (await http<{ status: ZoneMemberStatus }>(`/v1/forum/zones/${zoneId}/join`, {
    method: "POST",
  })) as { status: ZoneMemberStatus };
}

export async function listThreads(zoneId: string, before?: string): Promise<ThreadFeed> {
  const qs = new URLSearchParams({ limit: "30" });
  if (before) qs.set("before", before);
  return (await http<ThreadFeed>(`/v1/forum/zones/${zoneId}/threads?${qs.toString()}`)) as ThreadFeed;
}

export async function postThread(
  zoneId: string,
  body: string,
  title?: string,
): Promise<ThreadView> {
  return (await http<ThreadView>(`/v1/forum/zones/${zoneId}/threads`, {
    method: "POST",
    body: JSON.stringify({ body, ...(title ? { title } : {}) }),
  })) as ThreadView;
}

export async function reactThread(threadId: string, emoji: string): Promise<void> {
  await http(`/v1/forum/threads/${threadId}/reactions`, {
    method: "PUT",
    body: JSON.stringify({ emoji }),
  });
}

export async function unreactThread(threadId: string, emoji: string): Promise<void> {
  await http(`/v1/forum/threads/${threadId}/reactions`, {
    method: "DELETE",
    body: JSON.stringify({ emoji }),
  });
}

export async function getQuestion(threadId: string): Promise<QuestionDetail> {
  return (await http<QuestionDetail>(`/v1/forum/threads/${threadId}`)) as QuestionDetail;
}

export async function postAnswer(threadId: string, body: string): Promise<AnswerView> {
  return (await http<AnswerView>(`/v1/forum/threads/${threadId}/answers`, {
    method: "POST",
    body: JSON.stringify({ body }),
  })) as AnswerView;
}

export async function acceptAnswer(threadId: string, postId: string): Promise<void> {
  await http(`/v1/forum/threads/${threadId}/accept/${postId}`, { method: "POST" });
}

export async function createReport(
  targetType: ModerationTargetType,
  targetId: string,
  reason: ReportReason,
  note?: string,
): Promise<void> {
  await http(`/v1/forum/reports`, {
    method: "POST",
    body: JSON.stringify({ targetType, targetId, reason, ...(note ? { note } : {}) }),
  });
}

/** True when the forum feature flag is off — entry card / screens render their disabled state. */
export function isForumDisabled(err: unknown): boolean {
  return err instanceof ApiClientError && err.body.code === "FORUM_DISABLED";
}
