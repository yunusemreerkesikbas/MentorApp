"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import {
  ModerationTargetType,
  type CommentDetail,
  type CommentView,
} from "@mentor/types";
import { ApiClientError } from "@mentor/api-client";
import { Link } from "@/i18n/navigation";
import { FormError } from "@/components/form";
import { toggleReaction } from "@/lib/forum-reactions";
import {
  bookmarkPost,
  getCommentDetail,
  isForumDisabled,
  postReply,
  reactPost,
  unreactPost,
} from "@/lib/forum";
import type { AttachmentInput } from "@mentor/validation";
import { relativeTime } from "@/lib/relative-time";
import { AuthorAvatar } from "../../../_components/author-avatar";
import { AuthorLink } from "../../../_components/author-link";
import { CommentRow } from "../../../_components/comment-row";
import { ReactionBar } from "../../../_components/reaction-bar";
import { AttachmentGallery } from "../../../_components/attachment-gallery";
import { MentionText } from "../../../_components/mention-text";
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
  const t = useTranslations("community");
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

  /** Optimistic reaction for any comment id (focused comment or a reply). */
  const onToggleReaction = useCallback((id: string, emoji: string, adding: boolean) => {
    setState((s) => (s.status === "ready" ? patchReaction(s, id, emoji, adding) : s));
    const call = adding ? reactPost(id, emoji) : unreactPost(id, emoji);
    call.catch(() => setState((s) => (s.status === "ready" ? patchReaction(s, id, emoji, !adding) : s)));
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
    ? {
        pathname: "/community/comment/[postId]" as const,
        params: { postId: comment.parentPostId },
      }
    : {
        pathname: "/community/message/[threadId]" as const,
        params: { threadId: comment.threadId },
      };

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
          onToggleReaction={onToggleReaction}
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
                onToggleReaction={onToggleReaction}
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
  onToggleReaction,
  onToggleBookmark,
}: {
  comment: CommentView;
  onToggleReaction: (id: string, emoji: string, adding: boolean) => void;
  onToggleBookmark: (id: string, adding: boolean) => void;
}) {
  const t = useTranslations("community");
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
        <div className="-ml-1.5 mt-2 flex flex-wrap items-center gap-2">
          <ReactionBar
            reactionCounts={comment.reactionCounts}
            myReactions={comment.myReactions}
            onToggle={(emoji, adding) => onToggleReaction(comment.id, emoji, adding)}
          />

          <SendButton
            href={{
              pathname: "/community/comment/[postId]",
              params: { postId: comment.id },
            }}
          />
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

/** Optimistic reaction patch across the focused comment + its replies. */
function patchReaction(s: ReadyState, id: string, emoji: string, adding: boolean): ReadyState {
  const bump = (c: CommentView): CommentView => (c.id === id ? toggleReaction(c, emoji, adding) : c);
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
