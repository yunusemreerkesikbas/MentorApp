import type { AnswerView, Attachment, CommentView, ThreadView } from "@mentor/types";
import type { StoragePort } from "../../../shared/ports/storage.port";
import type { ThreadWithAuthor } from "../infrastructure/forum-thread.repository";
import type { PostWithAuthor } from "../infrastructure/forum-post.repository";
import type { AttachmentRow } from "../infrastructure/forum-attachment.repository";

type PublicStorage = Pick<StoragePort, "getPublicUrl">;

function avatarUrl(key: string | null, storage: PublicStorage): string | null {
  return key ? storage.getPublicUrl(key) : null;
}

/** Attachment rows → public view (resolve each storage key to a URL, same call used for avatars). */
function attachmentsToView(rows: AttachmentRow[], storage: PublicStorage): Attachment[] {
  return rows.map((a) => ({
    id: a.id,
    kind: a.kind as Attachment["kind"],
    url: storage.getPublicUrl(a.storageKey),
    mimeType: a.mimeType,
    width: a.width,
    height: a.height,
  }));
}

/** Row → ThreadView (shared by the feed + QA services). */
export function threadRowToView(
  t: ThreadWithAuthor,
  reactionCounts: Record<string, number>,
  myReactions: string[],
  storage: PublicStorage,
  commentCount = 0,
  commenterNames: string[] = [],
  attachments: AttachmentRow[] = [],
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
    attachments: attachmentsToView(attachments, storage),
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
  attachments: AttachmentRow[] = [],
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
    attachments: attachmentsToView(attachments, storage),
    createdAt: p.createdAt.toISOString(),
  };
}

/** Row → AnswerView (QA). */
export function postRowToAnswerView(
  p: PostWithAuthor,
  storage: PublicStorage,
  attachments: AttachmentRow[] = [],
): AnswerView {
  return {
    id: p.id,
    threadId: p.threadId,
    authorId: p.authorId,
    authorName: p.authorName,
    authorUsername: p.authorUsername,
    authorAvatarUrl: avatarUrl(p.authorAvatarStorageKey, storage),
    body: p.body,
    isAccepted: p.isAccepted,
    attachments: attachmentsToView(attachments, storage),
    createdAt: p.createdAt.toISOString(),
  };
}
