"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import {
  FORUM_LIKE_EMOJI,
  ModerationTargetType,
  type CommentDetail,
  type CommentView,
} from "@mentor/types";
import { ApiClientError } from "@mentor/api-client";
import { Link } from "@/i18n/navigation";
import { FormError } from "@/components/form";
import {
  bookmarkPost,
  getCommentDetail,
  isForumDisabled,
  likePost,
  postReply,
  unlikePost,
} from "@/lib/forum";
import type { AttachmentInput } from "@mentor/validation";
import { relativeTime } from "@/lib/relative-time";
import { AuthorAvatar } from "../../../_components/author-avatar";
import { AuthorLink } from "../../../_components/author-link";
import { CommentRow } from "../../../_components/comment-row";
import { AttachmentGallery } from "../../../_components/attachment-gallery";
import { MentionText } from "../../../_components/mention-text";
import { HeartIcon } from "../../../_components/forum-icons";
import { SendButton } from "../../../_components/send-button";
import { BookmarkButton } from "../../../_components/bookmark-button";
import { ThreadComposer } from "../../../[slug]/_components/thread-composer";
import { ThreadMenu } from "../../../[slug]/_components/thread-menu";

type State =
  | { status: "loading" }
  | { status: "disabled" }
  | { status: "error"; message: string }
  | { status: "ready"; comment: CommentView; replies: CommentView[]; zoneId: string };

/** Comment detail — a focused comment + its direct replies (Twitter-style recursive navigation). */
export function CommentShell({ postId }: { postId: string }) {
  const t = useTranslations("topluluk");
  const highlightId = useSearchParams().get("highlight");
  const [state, setState] = useState<State>({ status: "loading" });

  const apply = useCallback((detail: CommentDetail) => {
    setState({ status: "ready", comment: detail.comment, replies: detail.replies, zoneId: detail.zoneId });
  }, []);

  useEffect(() => {
    let active = true;
    getCommentDetail(postId)
      .then((detail) => {
        if (active) apply(detail);
      })
      .catch((err: unknown) => {
        if (!active) return;
        if (isForumDisabled(err)) return setState({ status: "disabled" });
        setState({
          status: "error",
          message: err instanceof ApiClientError ? err.body.message : t("error"),
        });
      });
    return () => {
      active = false;
    };
  }, [postId, apply, t]);

  /** Optimistic like for any comment id (focused comment or a reply). */
  const onToggleLike = useCallback((id: string, adding: boolean) => {
    setState((s) => (s.status === "ready" ? patchLike(s, id, adding) : s));
    const call = adding ? likePost(id, FORUM_LIKE_EMOJI) : unlikePost(id, FORUM_LIKE_EMOJI);
    call.catch(() => setState((s) => (s.status === "ready" ? patchLike(s, id, !adding) : s)));
  }, []);

  /** Optimistic bookmark for any comment id (focused comment or a reply). */
  const onToggleBookmark = useCallback((id: string, adding: boolean) => {
    setState((s) => (s.status === "ready" ? patchBookmark(s, id, adding) : s));
    bookmarkPost(id, adding).catch(() =>
      setState((s) => (s.status === "ready" ? patchBookmark(s, id, !adding) : s)),
    );
  }, []);

  const onReply = useCallback(
    async (body: string, attachments: AttachmentInput[]) => {
      const created = await postReply(postId, body, attachments);
      setState((s) =>
        s.status === "ready"
          ? {
              ...s,
              replies: [...s.replies, created],
              comment: { ...s.comment, replyCount: s.comment.replyCount + 1 },
            }
          : s,
      );
    },
    [postId],
  );

  if (state.status === "loading") return <Centered>{t("loading")}</Centered>;
  if (state.status === "disabled") return <Centered>{t("soon_title")}</Centered>;
  if (state.status === "error") {
    return (
      <main className="mx-auto w-full max-w-2xl px-4 py-6 lg:px-8">
        <FormError message={state.message} />
      </main>
    );
  }

  const { comment, replies } = state;
  const backHref = comment.parentPostId
    ? `/topluluk/yorum/${comment.parentPostId}`
    : `/topluluk/mesaj/${comment.threadId}`;

  return (
    <main className="mx-auto min-w-0 max-w-2xl px-4 py-6 lg:px-8 lg:py-8">
      <Link
        href={backHref}
        className="mb-3 flex items-center gap-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
        style={{ color: "var(--color-secondary)" }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="15 18 9 12 15 6" /></svg>
        {t("back_short")}
      </Link>

      {/* Focused comment (not clickable — this is its own page) */}
      <div className="border-b" style={{ borderColor: "rgba(0,0,0,0.08)" }}>
        <FocusedComment
          comment={comment}
          onToggleLike={onToggleLike}
          onToggleBookmark={onToggleBookmark}
        />
      </div>

      {/* Reply composer — always directly under the post, before any replies */}
      <div className="border-b" style={{ borderColor: "rgba(0,0,0,0.08)" }}>
        <ThreadComposer
          placeholder={t("reply_placeholder")}
          submitLabel={t("reply_submit")}
          onSubmit={onReply}
          zoneId={state.zoneId}
        />
      </div>

      {/* Replies (nothing shown when empty — the composer above is the call to action) */}
      {replies.length > 0 && (
        <>
          <h2
            className="mb-1 mt-6 px-3 text-[11px] font-semibold uppercase tracking-wide"
            style={{ color: "var(--color-secondary)" }}
          >
            {t("replies_title")}
          </h2>
          <div className="divide-y divide-[rgba(0,0,0,0.06)]">
            {replies.map((r) => (
              <CommentRow
                key={r.id}
                comment={r}
                onToggleLike={onToggleLike}
                onToggleBookmark={onToggleBookmark}
                highlighted={r.id === highlightId}
              />
            ))}
          </div>
        </>
      )}
    </main>
  );
}

function FocusedComment({
  comment,
  onToggleLike,
  onToggleBookmark,
}: {
  comment: CommentView;
  onToggleLike: (id: string, adding: boolean) => void;
  onToggleBookmark: (id: string, adding: boolean) => void;
}) {
  const t = useTranslations("topluluk");
  const locale = useLocale();
  return (
    <div className="group flex items-start gap-3 py-4 pl-3 pr-4">
      <AuthorLink username={comment.authorUsername}>
        <AuthorAvatar name={comment.authorName} size={40} src={comment.authorAvatarUrl} />
      </AuthorLink>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <AuthorLink
            username={comment.authorUsername}
            className="flex-shrink truncate text-[15px] font-semibold hover:underline"
          >
            <span style={{ color: "var(--color-main)" }}>{comment.authorName || t("unknown_author")}</span>
          </AuthorLink>
          {comment.authorUsername && (
            <span className="flex-shrink truncate text-[13px]" style={{ color: "var(--color-secondary)" }}>
              @{comment.authorUsername}
            </span>
          )}
          <span className="flex-shrink-0 whitespace-nowrap text-xs" style={{ color: "var(--color-secondary)" }}>
            · {relativeTime(comment.createdAt, locale)}
          </span>
          <span className="ml-auto flex-shrink-0">
            <ThreadMenu targetId={comment.id} targetType={ModerationTargetType.POST} />
          </span>
        </div>
        <p className="mt-1.5 whitespace-pre-wrap break-words text-[16px] leading-[24px]" style={{ color: "var(--color-body)" }}>
          <MentionText text={comment.body} />
        </p>
        <AttachmentGallery attachments={comment.attachments} />
        <div className="-ml-1.5 mt-2 flex items-center">
          <button
            type="button"
            aria-pressed={comment.myLiked}
            aria-label={t("like")}
            onClick={() => onToggleLike(comment.id, !comment.myLiked)}
            className="group/like flex h-8 items-center gap-1 rounded-full px-1.5 transition-colors hover:bg-black/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
            style={{ color: comment.myLiked ? "var(--color-danger)" : "var(--color-main)" }}
          >
            <span
              key={comment.myLiked ? "on" : "off"}
              className={`inline-flex transition-transform duration-150 group-hover/like:scale-110 motion-reduce:transition-none ${comment.myLiked ? "forum-like-pop" : ""}`}
            >
              <HeartIcon filled={comment.myLiked} />
            </span>
            {comment.likeCount > 0 && (
              <span className="text-[13px] tabular-nums">{comment.likeCount}</span>
            )}
          </button>

          <SendButton path={`/topluluk/yorum/${comment.id}`} />
          <BookmarkButton
            bookmarked={comment.myBookmarked}
            onToggle={(adding) => onToggleBookmark(comment.id, adding)}
          />
        </div>
      </div>
    </div>
  );
}

type ReadyState = Extract<State, { status: "ready" }>;

/** Optimistic like patch across the focused comment + its replies. */
function patchLike(s: ReadyState, id: string, adding: boolean): ReadyState {
  const bump = (c: CommentView): CommentView =>
    c.id === id ? { ...c, myLiked: adding, likeCount: Math.max(0, c.likeCount + (adding ? 1 : -1)) } : c;
  return { ...s, comment: bump(s.comment), replies: s.replies.map(bump) };
}

/** Optimistic bookmark patch across the focused comment + its replies. */
function patchBookmark(s: ReadyState, id: string, adding: boolean): ReadyState {
  const bump = (c: CommentView): CommentView => (c.id === id ? { ...c, myBookmarked: adding } : c);
  return { ...s, comment: bump(s.comment), replies: s.replies.map(bump) };
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-[40vh] w-full max-w-2xl items-center justify-center px-5 py-8">
      <p style={{ color: "var(--color-secondary)" }}>{children}</p>
    </main>
  );
}
