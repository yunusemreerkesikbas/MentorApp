import type {
  AnswerView,
  CommentDetail,
  CommentView,
  ModerationTargetType,
  Paginated,
  QuestionDetail,
  ReportReason,
  ReportView,
  ThreadDetail,
  ThreadFeed,
  ThreadView,
  ZoneMemberStatus,
  ZoneMemberView,
  ZoneView,
} from "@mentor/types";
import type { AttachmentInput } from "@mentor/validation";
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

export type ThreadSort = "recent" | "popular";

export async function listThreads(
  zoneId: string,
  before?: string,
  sort: ThreadSort = "recent",
): Promise<ThreadFeed> {
  const qs = new URLSearchParams({ limit: "30" });
  if (before) qs.set("before", before);
  if (sort !== "recent") qs.set("sort", sort);
  return (await http<ThreadFeed>(`/v1/forum/zones/${zoneId}/threads?${qs.toString()}`)) as ThreadFeed;
}

export async function postThread(
  zoneId: string,
  body: string,
  title?: string,
  attachments?: AttachmentInput[],
): Promise<ThreadView> {
  return (await http<ThreadView>(`/v1/forum/zones/${zoneId}/threads`, {
    method: "POST",
    body: JSON.stringify({
      body,
      ...(title ? { title } : {}),
      ...(attachments?.length ? { attachments } : {}),
    }),
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

/** CHAT/ANNOUNCEMENT thread + its comments (oldest-first). */
export async function getThreadDetail(threadId: string): Promise<ThreadDetail> {
  return (await http<ThreadDetail>(`/v1/forum/threads/${threadId}/detail`)) as ThreadDetail;
}

/** Post a top-level comment on a CHAT/ANNOUNCEMENT thread. */
export async function postComment(
  threadId: string,
  body: string,
  attachments?: AttachmentInput[],
): Promise<CommentView> {
  return (await http<CommentView>(`/v1/forum/threads/${threadId}/comments`, {
    method: "POST",
    body: JSON.stringify({ body, ...(attachments?.length ? { attachments } : {}) }),
  })) as CommentView;
}

/** A focused comment + its direct replies (recursive navigation). */
export async function getCommentDetail(postId: string): Promise<CommentDetail> {
  return (await http<CommentDetail>(`/v1/forum/posts/${postId}`)) as CommentDetail;
}

/** Reply to a comment (nested). */
export async function postReply(
  postId: string,
  body: string,
  attachments?: AttachmentInput[],
): Promise<CommentView> {
  return (await http<CommentView>(`/v1/forum/posts/${postId}/replies`, {
    method: "POST",
    body: JSON.stringify({ body, ...(attachments?.length ? { attachments } : {}) }),
  })) as CommentView;
}

export async function likePost(postId: string, emoji: string): Promise<void> {
  await http(`/v1/forum/posts/${postId}/reactions`, {
    method: "PUT",
    body: JSON.stringify({ emoji }),
  });
}

export async function unlikePost(postId: string, emoji: string): Promise<void> {
  await http(`/v1/forum/posts/${postId}/reactions`, {
    method: "DELETE",
    body: JSON.stringify({ emoji }),
  });
}

export async function postAnswer(
  threadId: string,
  body: string,
  attachments?: AttachmentInput[],
): Promise<AnswerView> {
  return (await http<AnswerView>(`/v1/forum/threads/${threadId}/answers`, {
    method: "POST",
    body: JSON.stringify({ body, ...(attachments?.length ? { attachments } : {}) }),
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

export async function searchQuestions(q: string): Promise<Paginated<ThreadView>> {
  const qs = new URLSearchParams({ q, pageSize: "30" });
  return (await http<Paginated<ThreadView>>(`/v1/forum/search?${qs.toString()}`)) as Paginated<ThreadView>;
}

// --- Moderation surfaces (owner/mod or platform staff; backend authz-gated) ---

export async function listZoneMembers(
  zoneId: string,
  status?: ZoneMemberStatus,
): Promise<ZoneMemberView[]> {
  const qs = status ? `?status=${status}` : "";
  return (await http<ZoneMemberView[]>(`/v1/forum/zones/${zoneId}/members${qs}`)) as ZoneMemberView[];
}

export async function approveMember(
  zoneId: string,
  userId: string,
  approve: boolean,
): Promise<void> {
  await http(`/v1/forum/zones/${zoneId}/members/${userId}/approve`, {
    method: "POST",
    body: JSON.stringify({ approve }),
  });
}

export async function removeMember(zoneId: string, userId: string): Promise<void> {
  await http(`/v1/forum/zones/${zoneId}/members/${userId}`, { method: "DELETE" });
}

export async function listZoneReports(
  zoneId: string,
  status?: string,
): Promise<Paginated<ReportView>> {
  const qs = new URLSearchParams({ pageSize: "50" });
  if (status) qs.set("status", status);
  return (await http<Paginated<ReportView>>(
    `/v1/forum/zones/${zoneId}/reports?${qs.toString()}`,
  )) as Paginated<ReportView>;
}

export async function resolveReport(reportId: string, action: "HIDE" | "DISMISS"): Promise<void> {
  await http(`/v1/forum/reports/${reportId}/resolve`, {
    method: "POST",
    body: JSON.stringify({ action }),
  });
}

export async function restoreThread(threadId: string): Promise<void> {
  await http(`/v1/forum/threads/${threadId}/restore`, { method: "POST" });
}

export async function restoreAnswer(postId: string): Promise<void> {
  await http(`/v1/forum/answers/${postId}/restore`, { method: "POST" });
}

export async function pinThread(threadId: string, pinned: boolean): Promise<void> {
  await http(`/v1/forum/threads/${threadId}/pin`, {
    method: "POST",
    body: JSON.stringify({ pinned }),
  });
}

export async function deleteThread(threadId: string): Promise<void> {
  await http(`/v1/forum/threads/${threadId}`, { method: "DELETE" });
}

export async function deleteAnswer(postId: string): Promise<void> {
  await http(`/v1/forum/answers/${postId}`, { method: "DELETE" });
}

/** True when the forum feature flag is off — entry card / screens render their disabled state. */
export function isForumDisabled(err: unknown): boolean {
  return err instanceof ApiClientError && err.body.code === "FORUM_DISABLED";
}
