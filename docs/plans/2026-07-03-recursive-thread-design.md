# Recursive Thread (Twitter/Threads model) — Forum

**Date:** 2026-07-03 · **Feature:** APP-017 (forum) · **Status:** approved, implementing

## Problem

The forum is two levels deep and flat: a `forum_threads` row (chat message / QA question) can have
`forum_posts` (comments/answers), but a comment cannot be liked, cannot be replied to, and has no
detail view. Users expect a real thread model — every node (post *or* comment) is itself actionable
and has its own conversation.

## Decisions (confirmed)

- **Nesting model:** Twitter/Threads-style — recursive **by navigation**. Every post and comment is
  likeable + replyable. Each node has a detail page showing itself + its *direct* replies (flat).
  Clicking a reply opens *its* detail page. Unlimited depth, one level per screen. No inline tree.
- **Scope:** full package now — comment like + reply (nesting) + comment detail page + recursive nav.
- **QA out of scope:** capabilities apply only to CHAT/ANNOUNCEMENT comments. QA keeps its
  answer/accept flow (`forum_posts` is shared, but behaviour is gated by the parent zone's type).
- **Notifications on reply:** backlog (not this epic).
- **Replies per node:** show all on first load (reply volume is low); paginate later if needed (YAGNI).

## Data model (2 migrations, additive)

1. `forum_posts.parent_post_id` — nullable uuid, self-FK → `forum_posts.id`. `null` = top-level
   comment on the thread; set = a reply to another comment. Existing rows stay `null` (compatible).
2. `forum_post_reactions` — new table `(id, post_id FK, user_id FK, emoji, created_at)`, unique
   `(post_id, user_id, emoji)`. Separate from `forum_reactions` (whose `thread_id` is NOT NULL) to
   avoid polymorphic nullable columns and leave existing thread-reaction queries untouched. RLS
   mirrors `forum_reactions` (read: authed + non-deleted; writes: SERVICE context).

Like/reply counts are computed on read (batched), like thread counts — no denormalized columns.

## Types (`packages/types`)

- `CommentView { id, threadId, parentPostId, authorId, authorName, body, likeCount, myLiked,
  replyCount, createdAt }` — new (QA's `AnswerView` unchanged).
- `CommentDetail { comment: CommentView; replies: CommentView[] }`.
- `ThreadDetail.comments` → `CommentView[]` (top-level only).
- Reuse `FORUM_LIKE_EMOJI` for post likes.

## Backend (`apps/api`)

- **Repo (`ForumPostRepository`)**: `createReply({threadId, parentPostId, authorId, body})`;
  `listTopLevel(threadId, viewerId)` (parent null); `listReplies(parentPostId, viewerId)`;
  `findById` (exists); batched `likeCountsByPost`, `myLikesByPost`, `replyCountsByPost`;
  `addPostReaction / removePostReaction`.
- **Service (`ForumThreadService`)**: `getThreadDetail` → top-level comments as `CommentView`;
  `getCommentDetail(viewerId, postId)` → `{comment, replies}`; `replyToComment(actor, postId, body)`
  (threadId = root thread, authorized via existing `canCommentInZone` on the parent zone; QA parent
  rejected); `likePost/unlikePost(userId, postId)`.
- **Controller**: `POST /forum/posts/:postId/replies`, `GET /forum/posts/:postId`,
  `PUT|DELETE /forum/posts/:postId/reactions`. Delete/report reuse existing `/answers/:postId` + reports.
- **Mapper**: `postRowToCommentView(row, likeCount, myLiked, replyCount)`.

## Frontend (`apps/web`)

- **lib/forum**: `getCommentDetail`, `postReply`, `likePost/unlikePost` (reuse `http`).
- **CommentRow** (shared): avatar + name + time + body + action row (like + reply count) + ⋯; whole
  row clickable → `/topluluk/yorum/[postId]` (Twitter-style, interactive children stop propagation).
- **Route** `/topluluk/yorum/[postId]` + `CommentShell`: focused comment (rendered like a thread) +
  reply composer + direct replies list (each a CommentRow → deeper). Recursive.
- **MessageShell** (thread detail): render comments via the new CommentRow (like + reply + click).

## Verification

- `pnpm --filter @mentor/api db:generate` → migration; apply on the running dev DB.
- Unit: `replyToComment` (member allowed, non-member forbidden, QA parent rejected), `likePost`
  toggles, `getCommentDetail` shape.
- e2e: thread → comment → reply → reply (depth), like a comment, counts reflect.
- Manual: click a comment → its detail → reply → like; verify recursive navigation + optimistic UI.
- Extend the seed script to add a few nested replies + comment likes for testing.
