import { ApiClientError, http } from "@mentor/api-client";
import type { AttachmentInput } from "@mentor/validation";
import type {
  AnswerView,
  CommentDetail,
  CommentView,
  ForumActivityFeed,
  ForumCoachBridgeView,
  ForumFeed,
  ForumFeedScope,
  ForumFeedSort,
  ForumHubView,
  ForumPollView,
  ForumSearchView,
  ForumTagView,
  ForumZoneFeedView,
  ModerationTargetType,
  Paginated,
  QuestionDetail,
  ReportReason,
  SavedFeed,
  ThreadDetail,
  ThreadView,
  ZoneMemberStatus,
  ZoneView,
} from "@mentor/types";
import type { ForumPollInput } from "@mentor/validation";
import type { ThreadSort } from "./forum-api-types.js";

export type { ThreadSort };

export async function getForumHub(): Promise<ForumHubView> {
  return (await http<ForumHubView>("/v1/forum/hub")) as ForumHubView;
}

export async function getForumFeed(input: {
  scope: ForumFeedScope;
  sort: ForumFeedSort;
  tag?: string;
  contentType?: "posts" | "questions";
  unanswered?: boolean;
  cursor?: string;
  limit?: number;
}): Promise<ForumFeed> {
  const qs = new URLSearchParams({
    scope: input.scope,
    sort: input.sort,
    limit: String(input.limit ?? 20),
  });
  if (input.tag) qs.set("tag", input.tag);
  if (input.contentType) qs.set("contentType", input.contentType);
  if (input.unanswered) qs.set("unanswered", "true");
  if (input.cursor) qs.set("cursor", input.cursor);
  return (await http<ForumFeed>(`/v1/forum/feed?${qs.toString()}`)) as ForumFeed;
}

export async function listForumZones(): Promise<ZoneView[]> {
  const page = await http<Paginated<ZoneView>>("/v1/forum/zones?pageSize=100");
  return page?.items ?? [];
}

export async function getZoneFeed(
  slug: string,
  sort: ThreadSort = "recent",
  before?: string,
): Promise<ForumZoneFeedView> {
  const qs = new URLSearchParams({ sort, limit: "30" });
  if (before) qs.set("before", before);
  return (await http<ForumZoneFeedView>(
    `/v1/forum/zones/${encodeURIComponent(slug)}/feed?${qs.toString()}`,
  )) as ForumZoneFeedView;
}

export async function joinZone(zoneId: string): Promise<{ status: ZoneMemberStatus }> {
  return (await http<{ status: ZoneMemberStatus }>(
    `/v1/forum/zones/${encodeURIComponent(zoneId)}/join`,
    { method: "POST" },
  )) as { status: ZoneMemberStatus };
}

export async function leaveZone(zoneId: string): Promise<void> {
  await http(`/v1/forum/zones/${encodeURIComponent(zoneId)}/leave`, { method: "POST" });
}

export async function postZoneThread(input: {
  zoneId: string;
  body: string;
  title?: string;
  tagIds?: string[];
  poll?: ForumPollInput;
  attachments?: AttachmentInput[];
}): Promise<ThreadView> {
  return (await http<ThreadView>(
    `/v1/forum/zones/${encodeURIComponent(input.zoneId)}/threads`,
    {
      method: "POST",
      body: JSON.stringify({
        body: input.body.trim(),
        ...(input.title?.trim() ? { title: input.title.trim() } : {}),
        ...(input.tagIds?.length ? { tagIds: input.tagIds } : {}),
        ...(input.poll ? { poll: input.poll } : {}),
        ...(input.attachments?.length ? { attachments: input.attachments } : {}),
      }),
    },
  )) as ThreadView;
}

export async function votePoll(pollId: string, optionId: string): Promise<ForumPollView> {
  return (await http<ForumPollView>(
    `/v1/forum/polls/${encodeURIComponent(pollId)}/votes`,
    { method: "POST", body: JSON.stringify({ optionId }) },
  )) as ForumPollView;
}

export async function getQuestion(threadId: string): Promise<QuestionDetail> {
  return (await http<QuestionDetail>(
    `/v1/forum/threads/${encodeURIComponent(threadId)}`,
  )) as QuestionDetail;
}

export async function getThreadDetail(threadId: string): Promise<ThreadDetail> {
  return (await http<ThreadDetail>(
    `/v1/forum/threads/${encodeURIComponent(threadId)}/detail`,
  )) as ThreadDetail;
}

const replyBody = (body: string, attachments?: AttachmentInput[]) =>
  JSON.stringify({ body: body.trim(), ...(attachments?.length ? { attachments } : {}) });

export async function postThreadComment(input: {
  threadId: string;
  body: string;
  attachments?: AttachmentInput[];
}): Promise<CommentView> {
  return (await http<CommentView>(
    `/v1/forum/threads/${encodeURIComponent(input.threadId)}/comments`,
    { method: "POST", body: replyBody(input.body, input.attachments) },
  )) as CommentView;
}

export async function postQuestionAnswer(input: {
  threadId: string;
  body: string;
  attachments?: AttachmentInput[];
}): Promise<AnswerView> {
  return (await http<AnswerView>(
    `/v1/forum/threads/${encodeURIComponent(input.threadId)}/answers`,
    { method: "POST", body: replyBody(input.body, input.attachments) },
  )) as AnswerView;
}

export async function getCommentDetail(postId: string): Promise<CommentDetail> {
  return (await http<CommentDetail>(`/v1/forum/posts/${encodeURIComponent(postId)}`)) as CommentDetail;
}

export async function postCommentReply(input: {
  postId: string;
  body: string;
  attachments?: AttachmentInput[];
}): Promise<CommentView> {
  return (await http<CommentView>(
    `/v1/forum/posts/${encodeURIComponent(input.postId)}/replies`,
    { method: "POST", body: replyBody(input.body, input.attachments) },
  )) as CommentView;
}

export async function acceptQuestionAnswer(threadId: string, postId: string): Promise<void> {
  await http(`/v1/forum/threads/${encodeURIComponent(threadId)}/accept/${encodeURIComponent(postId)}`, {
    method: "POST",
  });
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

export async function togglePostReaction(input: {
  postId: string;
  emoji: string;
  active: boolean;
}): Promise<void> {
  await http(`/v1/forum/posts/${encodeURIComponent(input.postId)}/reactions`, {
    method: input.active ? "DELETE" : "PUT",
    body: JSON.stringify({ emoji: input.emoji }),
  });
}

export async function setHelpfulVote(
  targetType: ModerationTargetType,
  targetId: string,
  selected: boolean,
): Promise<void> {
  const segment = targetType === "THREAD" ? "threads" : "posts";
  await http(`/v1/forum/${segment}/${encodeURIComponent(targetId)}/helpful-vote`, {
    method: selected ? "PUT" : "DELETE",
  });
}

export async function bookmarkThread(threadId: string, adding: boolean): Promise<void> {
  await http(`/v1/forum/threads/${encodeURIComponent(threadId)}/bookmark`, {
    method: adding ? "PUT" : "DELETE",
  });
}

export async function bookmarkPost(postId: string, adding: boolean): Promise<void> {
  await http(`/v1/forum/posts/${encodeURIComponent(postId)}/bookmark`, {
    method: adding ? "PUT" : "DELETE",
  });
}

export async function getBookmarks(before?: string): Promise<SavedFeed> {
  const qs = before ? `?before=${encodeURIComponent(before)}` : "";
  return (await http<SavedFeed>(`/v1/forum/bookmarks${qs}`)) as SavedFeed;
}

export async function searchForum(q: string): Promise<ForumSearchView> {
  const qs = new URLSearchParams({ q: q.trim() });
  return (await http<ForumSearchView>(`/v1/forum/search?${qs.toString()}`)) as ForumSearchView;
}

export async function listForumTags(): Promise<ForumTagView[]> {
  return (await http<ForumTagView[]>("/v1/forum/tags")) as ForumTagView[];
}

export async function createForumReport(input: {
  targetType: ModerationTargetType;
  targetId: string;
  reason: ReportReason;
  note?: string;
}): Promise<void> {
  await http("/v1/forum/reports", {
    method: "POST",
    body: JSON.stringify({
      targetType: input.targetType,
      targetId: input.targetId,
      reason: input.reason,
      ...(input.note?.trim() ? { note: input.note.trim() } : {}),
    }),
  });
}

export async function deleteForumThread(threadId: string): Promise<void> {
  await http(`/v1/forum/threads/${encodeURIComponent(threadId)}`, { method: "DELETE" });
}

export async function deleteForumAnswer(postId: string): Promise<void> {
  await http(`/v1/forum/answers/${encodeURIComponent(postId)}`, { method: "DELETE" });
}

export async function getForumCoachBridge(threadId: string): Promise<ForumCoachBridgeView> {
  return (await http<ForumCoachBridgeView>(
    `/v1/forum/threads/${encodeURIComponent(threadId)}/coach-bridge`,
  )) as ForumCoachBridgeView;
}

export async function getUserForumActivity(
  username: string,
  before?: string,
): Promise<ForumActivityFeed> {
  const qs = before ? `?before=${encodeURIComponent(before)}` : "";
  return (await http<ForumActivityFeed>(
    `/v1/forum/users/${encodeURIComponent(username)}/activity${qs}`,
  )) as ForumActivityFeed;
}

export function isForumDisabled(err: unknown): boolean {
  return err instanceof ApiClientError && err.body.code === "FORUM_DISABLED";
}
