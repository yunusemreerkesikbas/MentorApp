import type { AnswerView, ThreadView } from "@mentor/types";
import type { ThreadRow } from "../infrastructure/forum-thread.repository";
import type { PostRow } from "../infrastructure/forum-post.repository";

/** Row → ThreadView (shared by the feed + QA services). */
export function threadRowToView(
  t: ThreadRow,
  reactionCounts: Record<string, number>,
  myReactions: string[],
): ThreadView {
  return {
    id: t.id,
    zoneId: t.zoneId,
    authorId: t.authorId,
    title: t.title,
    body: t.body,
    status: t.status as ThreadView["status"],
    acceptedPostId: t.acceptedPostId,
    isPinned: t.isPinned,
    reactionCounts,
    myReactions,
    createdAt: t.createdAt.toISOString(),
  };
}

/** Row → AnswerView (QA). */
export function postRowToAnswerView(p: PostRow): AnswerView {
  return {
    id: p.id,
    threadId: p.threadId,
    authorId: p.authorId,
    body: p.body,
    isAccepted: p.isAccepted,
    createdAt: p.createdAt.toISOString(),
  };
}
