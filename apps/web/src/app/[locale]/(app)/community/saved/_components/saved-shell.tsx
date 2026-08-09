"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { type SavedFeedItem } from "@mentor/types";
import { ApiClientError } from "@mentor/api-client";
import { Button } from "@mentor/ui";
import { FormError } from "@/components/form";
import { replaceReaction } from "@/lib/forum-reactions";
import {
  bookmarkPost,
  bookmarkThread,
  getBookmarks,
  isForumDisabled,
  reactPost,
  reactThread,
  unreactPost,
  unreactThread,
} from "@/lib/forum";
import { BookmarkIcon } from "../../_components/forum-icons";
import { CommentRow } from "../../_components/comment-row";
import { ThreadItem } from "../../[slug]/_components/thread-item";

type State =
  | { status: "loading" }
  | { status: "disabled" }
  | { status: "error"; message: string }
  | { status: "ready"; items: SavedFeedItem[]; nextCursor: string | null; loadingMore: boolean };

/**
 * "Kaydedilenler" — the viewer's saved threads + comments, newest-saved first. `embedded` drops the
 * outer `<main>` + page title so it can live inside another page's container (the profile Saved tab),
 * which already provides the landmark and heading.
 */
export function SavedShell({ embedded = false }: { embedded?: boolean } = {}) {
  const t = useTranslations("community");
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    let active = true;
    getBookmarks()
      .then((feed) => {
        if (active) setState({ status: "ready", ...feed, loadingMore: false });
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
  }, [t]);

  const patchReady = useCallback(
    (fn: (r: Extract<State, { status: "ready" }>) => Extract<State, { status: "ready" }>) =>
      setState((s) => (s.status === "ready" ? fn(s) : s)),
    [],
  );

  const loadMore = useCallback(() => {
    setState((s) => {
      if (s.status !== "ready" || !s.nextCursor || s.loadingMore) return s;
      getBookmarks(s.nextCursor)
        .then((feed) =>
          patchReady((r) => ({
            ...r,
            items: [...r.items, ...feed.items],
            nextCursor: feed.nextCursor,
            loadingMore: false,
          })),
        )
        .catch(() => patchReady((r) => ({ ...r, loadingMore: false })));
      return { ...s, loadingMore: true };
    });
  }, [patchReady]);

  const onToggleReaction = useCallback(
    (threadId: string, nextEmoji: string | null, previousEmoji: string | null) => {
      const patch = (emoji: string | null) => (r: Extract<State, { status: "ready" }>) => ({
        ...r,
        items: r.items.map((it) =>
          it.type === "thread" && it.thread.id === threadId
            ? { ...it, thread: replaceReaction(it.thread, emoji) }
            : it,
        ),
      });
      patchReady(patch(nextEmoji));
      const call = nextEmoji ? reactThread(threadId, nextEmoji) : previousEmoji ? unreactThread(threadId, previousEmoji) : Promise.resolve();
      call.catch(() => patchReady(patch(previousEmoji)));
    },
    [patchReady],
  );

  const onToggleCommentReaction = useCallback(
    (postId: string, nextEmoji: string | null, previousEmoji: string | null) => {
      const patch = (emoji: string | null) => (r: Extract<State, { status: "ready" }>) => ({
        ...r,
        items: r.items.map((it) =>
          it.type === "comment" && it.comment.id === postId
            ? { ...it, comment: replaceReaction(it.comment, emoji) }
            : it,
        ),
      });
      patchReady(patch(nextEmoji));
      const call = nextEmoji ? reactPost(postId, nextEmoji) : previousEmoji ? unreactPost(postId, previousEmoji) : Promise.resolve();
      call.catch(() => patchReady(patch(previousEmoji)));
    },
    [patchReady],
  );

  const onReplyCountChange = useCallback(
    (type: SavedFeedItem["type"], id: string, delta: 1 | -1) => {
      patchReady((ready) => ({
        ...ready,
        items: ready.items.map((item) => {
          if (type === "thread" && item.type === "thread" && item.thread.id === id) {
            return {
              ...item,
              thread: {
                ...item.thread,
                commentCount: Math.max(0, item.thread.commentCount + delta),
              },
            };
          }
          if (type === "comment" && item.type === "comment" && item.comment.id === id) {
            return {
              ...item,
              comment: {
                ...item.comment,
                replyCount: Math.max(0, item.comment.replyCount + delta),
              },
            };
          }
          return item;
        }),
      }));
    },
    [patchReady],
  );

  // On this page every item is already saved — unbookmarking drops it (Twitter behavior).
  const removeItem = useCallback(
    (predicate: (it: SavedFeedItem) => boolean) =>
      patchReady((r) => ({ ...r, items: r.items.filter((it) => !predicate(it)) })),
    [patchReady],
  );

  const onUnbookmarkThread = useCallback(
    (threadId: string) => {
      removeItem((it) => it.type === "thread" && it.thread.id === threadId);
      bookmarkThread(threadId, false).catch(() => void 0);
    },
    [removeItem],
  );

  const onUnbookmarkComment = useCallback(
    (postId: string) => {
      removeItem((it) => it.type === "comment" && it.comment.id === postId);
      bookmarkPost(postId, false).catch(() => void 0);
    },
    [removeItem],
  );

  if (state.status === "loading") return <Centered embedded={embedded}>{t("loading")}</Centered>;
  if (state.status === "disabled") return <Centered embedded={embedded}>{t("soon_title")}</Centered>;
  if (state.status === "error") {
    const cls = "mx-auto w-full max-w-2xl px-4 py-6 lg:px-8";
    const body = <FormError message={state.message} />;
    return embedded ? <div className={cls}>{body}</div> : <main className={cls}>{body}</main>;
  }

  const { items, nextCursor, loadingMore } = state;
  const Root = embedded ? "div" : "main";

  return (
    <Root className={embedded ? "min-w-0" : "mx-auto min-w-0 max-w-2xl px-4 py-6 lg:px-8 lg:py-8"}>
      {!embedded && (
        <h1
          className="mb-4 px-3 text-lg font-bold"
          style={{ color: "var(--color-main)", fontFamily: "var(--font-heading)" }}
        >
          {t("saved_title")}
        </h1>
      )}

      {items.length === 0 ? (
        <div className="flex flex-col items-center px-6 py-16 text-center">
          <span
            className="flex h-12 w-12 items-center justify-center rounded-full"
            style={{ background: "color-mix(in srgb, var(--color-chip) 16%, white)", color: "var(--color-chip-text)" }}
            aria-hidden="true"
          >
            <BookmarkIcon filled={false} />
          </span>
          <p
            className="mt-3 text-[15px] font-semibold"
            style={{ color: "var(--color-main)", fontFamily: "var(--font-heading)" }}
          >
            {t("saved_empty")}
          </p>
        </div>
      ) : (
        <div className="divide-y divide-[rgba(0,0,0,0.06)]">
          {items.map((it) =>
            it.type === "thread" ? (
              <ThreadItem
                key={`t-${it.thread.id}`}
                thread={it.thread}
                onToggleReaction={(nextEmoji, previousEmoji) => onToggleReaction(it.thread.id, nextEmoji, previousEmoji)}
                // Every item here is already saved — the only toggle is unsaving (drops the row).
                onToggleBookmark={() => onUnbookmarkThread(it.thread.id)}
                onReplyCountChange={(delta) => onReplyCountChange("thread", it.thread.id, delta)}
                clickable
              />
            ) : (
              <CommentRow
                key={`c-${it.comment.id}`}
                comment={it.comment}
                onToggleReaction={onToggleCommentReaction}
                onToggleBookmark={(id) => onUnbookmarkComment(id)}
                onReplyCountChange={(delta) => onReplyCountChange("comment", it.comment.id, delta)}
              />
            ),
          )}
        </div>
      )}

      {nextCursor && (
        <div className="mt-6 flex justify-center">
          <Button variant="secondary" busy={loadingMore} onClick={loadMore}>
            {t("saved_load_more")}
          </Button>
        </div>
      )}
    </Root>
  );
}

function Centered({ children, embedded }: { children: React.ReactNode; embedded?: boolean }) {
  const cls = "mx-auto flex min-h-[40vh] w-full max-w-2xl items-center justify-center px-5 py-8";
  const body = <p style={{ color: "var(--color-secondary)" }}>{children}</p>;
  return embedded ? <div className={cls}>{body}</div> : <main className={cls}>{body}</main>;
}
