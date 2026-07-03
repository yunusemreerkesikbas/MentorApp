import type { AnswerView, CommentView, ThreadView } from "@mentor/types";
import type { StoragePort } from "../../../shared/ports/storage.port";
import type { ThreadWithAuthor } from "../infrastructure/forum-thread.repository";
import type { PostWithAuthor } from "../infrastructure/forum-post.repository";

type PublicStorage = Pick<StoragePort, "getPublicUrl">;

function avatarUrl(key: string | null, storage: PublicStorage): string | null {
  return key ? storage.getPublicUrl(key) : null;
}

/** Row → ThreadView (shared by the feed + QA services). */
export function threadRowToView(
  t: ThreadWithAuthor,
  reactionCounts: Record<string, number>,
  myReactions: string[],
  storage: PublicStorage,
  commentCount = 0,
  commenterNames: string[] = [],
): ThreadView {
  return {
    id: t.id,
    zoneId: t.zoneId,
    authorId: t.authorId,
    authorName: t.authorName,
    authorUsername: t.authorUsername,
    authorAvatarUrl: avatarUrl(t.authorAvatarStorageKey, storage),
    title: t.title,
    body: t.body,
    status: t.status as ThreadView["status"],
    acceptedPostId: t.acceptedPostId,
    isPinned: t.isPinned,
    reactionCounts,
    myReactions,
    commentCount,
    commenterNames,
    createdAt: t.createdAt.toISOString(),
  };
}

/** Row → CommentView (CHAT/ANNOUNCEMENT comment — likeable + replyable). Counts folded in. */
export function postRowToCommentView(
  p: PostWithAuthor,
  likeCount: number,
  myLiked: boolean,
  replyCount: number,
  storage: PublicStorage,
): CommentView {
  return {
    id: p.id,
    threadId: p.threadId,
    parentPostId: p.parentPostId,
    authorId: p.authorId,
    authorName: p.authorName,
    authorUsername: p.authorUsername,
    authorAvatarUrl: avatarUrl(p.authorAvatarStorageKey, storage),
    body: p.body,
    likeCount,
    myLiked,
    replyCount,
    createdAt: p.createdAt.toISOString(),
  };
}

/** Row → AnswerView (QA). */
export function postRowToAnswerView(p: PostWithAuthor, storage: PublicStorage): AnswerView {
  return {
    id: p.id,
    threadId: p.threadId,
    authorId: p.authorId,
    authorName: p.authorName,
    authorUsername: p.authorUsername,
    authorAvatarUrl: avatarUrl(p.authorAvatarStorageKey, storage),
    body: p.body,
    isAccepted: p.isAccepted,
    createdAt: p.createdAt.toISOString(),
  };
}
