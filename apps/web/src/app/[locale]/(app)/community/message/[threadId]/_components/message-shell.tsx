"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { type CommentView, type ThreadDetail, type ThreadView } from "@mentor/types";
import { ApiClientError } from "@mentor/api-client";
import { Link } from "@/i18n/navigation";
import { FormError } from "@/components/form";
import { toggleReaction } from "@/lib/forum-reactions";
import {
  bookmarkPost,
  bookmarkThread,
  getThreadDetail,
  isForumDisabled,
  postComment,
  reactPost,
  reactThread,
  unreactPost,
  unreactThread,
} from "@/lib/forum";
import type { AttachmentInput } from "@mentor/validation";
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
  const t = useTranslations("community");
  const highlightId = useSearchParams().get("highlight");
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

  const onToggleThreadReaction = useCallback(
    (emoji: string, adding: boolean) => {
      setState((s) => (s.status === "ready" ? { ...s, thread: toggleReaction(s.thread, emoji, adding) } : s));
      const call = adding ? reactThread(threadId, emoji) : unreactThread(threadId, emoji);
      call.catch(() => {
        setState((s) => (s.status === "ready" ? { ...s, thread: toggleReaction(s.thread, emoji, !adding) } : s));
      });
    },
    [threadId],
  );

  const onToggleCommentReaction = useCallback((postId: string, emoji: string, adding: boolean) => {
    const patch = (v: boolean) => (c: CommentView) => (c.id === postId ? toggleReaction(c, emoji, v) : c);
    setState((s) => (s.status === "ready" ? { ...s, comments: s.comments.map(patch(adding)) } : s));
    const call = adding ? reactPost(postId, emoji) : unreactPost(postId, emoji);
    call.catch(() => {
      setState((s) => (s.status === "ready" ? { ...s, comments: s.comments.map(patch(!adding)) } : s));
    });
  }, []);

  const onToggleThreadBookmark = useCallback(
    (adding: boolean) => {
      setState((s) => (s.status === "ready" ? { ...s, thread: { ...s.thread, myBookmarked: adding } } : s));
      bookmarkThread(threadId, adding).catch(() => {
        setState((s) =>
          s.status === "ready" ? { ...s, thread: { ...s.thread, myBookmarked: !adding } } : s,
        );
      });
    },
    [threadId],
  );

  const onToggleCommentBookmark = useCallback((postId: string, adding: boolean) => {
    setState((s) =>
      s.status === "ready"
        ? { ...s, comments: s.comments.map((c) => (c.id === postId ? { ...c, myBookmarked: adding } : c)) }
        : s,
    );
    bookmarkPost(postId, adding).catch(() => {
      setState((s) =>
        s.status === "ready"
          ? { ...s, comments: s.comments.map((c) => (c.id === postId ? { ...c, myBookmarked: !adding } : c)) }
          : s,
      );
    });
  }, []);

  const onComment = useCallback(
    async (body: string, attachments: AttachmentInput[]) => {
      const created = await postComment(threadId, body, attachments);
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
        href={`/community`}
        className="mb-3 flex items-center gap-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
        style={{ color: "var(--color-secondary)" }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="15 18 9 12 15 6" /></svg>
        {t("sidebar_title")}
      </Link>

      {/* Main thread */}
      <div className="border-b" style={{ borderColor: "rgba(0,0,0,0.08)" }}>
        <ThreadItem
          thread={thread}
          onToggleReaction={onToggleThreadReaction}
          onToggleBookmark={onToggleThreadBookmark}
        />
      </div>

      {/* Composer — always directly under the post, before any comments */}
      <div className="border-b" style={{ borderColor: "rgba(0,0,0,0.08)" }}>
        <ThreadComposer
          placeholder={t("comment_placeholder")}
          submitLabel={t("comment_submit")}
          onSubmit={onComment}
          zoneId={thread.zoneId}
        />
      </div>

      {/* Comments (nothing shown when empty — the composer above is the call to action) */}
      {comments.length > 0 && (
        <>
          <h2
            className="mb-1 mt-6 px-3 text-[11px] font-semibold uppercase tracking-wide"
            style={{ color: "var(--color-secondary)" }}
          >
            {t("comments_title")}
          </h2>
          <div className="divide-y divide-[rgba(0,0,0,0.06)]">
            {comments.map((c) => (
              <CommentRow
                key={c.id}
                comment={c}
                onToggleReaction={onToggleCommentReaction}
                onToggleBookmark={onToggleCommentBookmark}
                highlighted={c.id === highlightId}
              />
            ))}
          </div>
        </>
      )}
    </main>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-[40vh] w-full max-w-2xl items-center justify-center px-5 py-8">
      <p style={{ color: "var(--color-secondary)" }}>{children}</p>
    </main>
  );
}
