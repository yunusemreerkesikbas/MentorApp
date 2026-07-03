"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { FORUM_LIKE_EMOJI, type CommentView, type ThreadDetail, type ThreadView } from "@mentor/types";
import { ApiClientError } from "@mentor/api-client";
import { Link } from "@/i18n/navigation";
import { FormError } from "@/components/form";
import {
  getThreadDetail,
  isForumDisabled,
  likePost,
  postComment,
  reactThread,
  unlikePost,
  unreactThread,
} from "@/lib/forum";
import { CommentIcon } from "../../../_components/forum-icons";
import { CommentRow } from "../../../_components/comment-row";
import { ThreadComposer } from "../../../[slug]/_components/thread-composer";
import { ThreadItem } from "../../../[slug]/_components/thread-item";

type State =
  | { status: "loading" }
  | { status: "disabled" }
  | { status: "error"; message: string }
  | { status: "ready"; thread: ThreadView; comments: CommentView[] };

/** Message detail (APP-017) — the thread + its top-level comments + a comment composer. */
export function MessageShell({ threadId }: { threadId: string }) {
  const t = useTranslations("topluluk");
  const [state, setState] = useState<State>({ status: "loading" });

  const apply = useCallback((detail: ThreadDetail) => {
    setState({ status: "ready", thread: detail.thread, comments: detail.comments });
  }, []);

  useEffect(() => {
    let active = true;
    getThreadDetail(threadId)
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
  }, [threadId, apply, t]);

  const onToggleThreadLike = useCallback(
    (emoji: string, adding: boolean) => {
      setState((s) => (s.status === "ready" ? { ...s, thread: applyReaction(s.thread, emoji, adding) } : s));
      const call = adding ? reactThread(threadId, emoji) : unreactThread(threadId, emoji);
      call.catch(() => {
        setState((s) => (s.status === "ready" ? { ...s, thread: applyReaction(s.thread, emoji, !adding) } : s));
      });
    },
    [threadId],
  );

  const onToggleCommentLike = useCallback((postId: string, adding: boolean) => {
    setState((s) =>
      s.status === "ready" ? { ...s, comments: s.comments.map((c) => applyCommentLike(c, postId, adding)) } : s,
    );
    const call = adding ? likePost(postId, FORUM_LIKE_EMOJI) : unlikePost(postId, FORUM_LIKE_EMOJI);
    call.catch(() => {
      setState((s) =>
        s.status === "ready" ? { ...s, comments: s.comments.map((c) => applyCommentLike(c, postId, !adding)) } : s,
      );
    });
  }, []);

  const onComment = useCallback(
    async (body: string) => {
      const created = await postComment(threadId, body);
      setState((s) =>
        s.status === "ready"
          ? {
              ...s,
              comments: [...s.comments, created],
              thread: { ...s.thread, commentCount: s.thread.commentCount + 1 },
            }
          : s,
      );
    },
    [threadId],
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

  const { thread, comments } = state;

  return (
    <main className="mx-auto min-w-0 max-w-2xl px-4 py-6 lg:px-8 lg:py-8">
      <Link
        href={`/topluluk`}
        className="mb-3 flex items-center gap-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
        style={{ color: "var(--color-secondary)" }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="15 18 9 12 15 6" /></svg>
        {t("sidebar_title")}
      </Link>

      {/* Main thread */}
      <div className="border-b" style={{ borderColor: "rgba(0,0,0,0.08)" }}>
        <ThreadItem thread={thread} onToggleReaction={onToggleThreadLike} />
      </div>

      {/* Comments */}
      {comments.length === 0 ? (
        <div className="flex flex-col items-center px-6 py-12 text-center">
          <span
            className="flex h-12 w-12 items-center justify-center rounded-full"
            style={{ background: "color-mix(in srgb, var(--color-chip) 16%, white)" }}
            aria-hidden="true"
          >
            <CommentIcon />
          </span>
          <p
            className="mt-3 text-[15px] font-semibold"
            style={{ color: "var(--color-main)", fontFamily: "var(--font-heading)" }}
          >
            {t("comments_empty_title")}
          </p>
          <p className="mt-1 text-[13px]" style={{ color: "var(--color-secondary)" }}>
            {t("comments_empty_desc")}
          </p>
        </div>
      ) : (
        <>
          <h2
            className="mb-1 mt-6 px-3 text-[11px] font-semibold uppercase tracking-wide"
            style={{ color: "var(--color-secondary)" }}
          >
            {t("comments_title")}
          </h2>
          <div className="divide-y divide-[rgba(0,0,0,0.06)]">
            {comments.map((c) => (
              <CommentRow key={c.id} comment={c} onToggleLike={onToggleCommentLike} />
            ))}
          </div>
        </>
      )}

      {/* Composer */}
      <div className="mt-4 border-t" style={{ borderColor: "rgba(0,0,0,0.08)" }}>
        <ThreadComposer
          placeholder={t("comment_placeholder")}
          submitLabel={t("comment_submit")}
          onSubmit={onComment}
        />
      </div>
    </main>
  );
}

/** Optimistic like toggle on the detail thread. */
function applyReaction(thread: ThreadView, emoji: string, adding: boolean): ThreadView {
  const count = thread.reactionCounts[emoji] ?? 0;
  const counts = { ...thread.reactionCounts, [emoji]: Math.max(0, count + (adding ? 1 : -1)) };
  if (counts[emoji] === 0) delete counts[emoji];
  const mine = adding ? [...thread.myReactions, emoji] : thread.myReactions.filter((e) => e !== emoji);
  return { ...thread, reactionCounts: counts, myReactions: mine };
}

/** Optimistic like toggle on one comment. */
function applyCommentLike(c: CommentView, postId: string, adding: boolean): CommentView {
  if (c.id !== postId) return c;
  return { ...c, myLiked: adding, likeCount: Math.max(0, c.likeCount + (adding ? 1 : -1)) };
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-[40vh] w-full max-w-2xl items-center justify-center px-5 py-8">
      <p style={{ color: "var(--color-secondary)" }}>{children}</p>
    </main>
  );
}
