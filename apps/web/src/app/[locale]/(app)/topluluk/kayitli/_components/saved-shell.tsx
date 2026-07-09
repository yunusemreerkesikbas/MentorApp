"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { FORUM_LIKE_EMOJI, type SavedFeedItem } from "@mentor/types";
import { ApiClientError } from "@mentor/api-client";
import { Button } from "@mentor/ui";
import { FormError } from "@/components/form";
import {
  bookmarkPost,
  bookmarkThread,
  getBookmarks,
  isForumDisabled,
  likePost,
  reactThread,
  unlikePost,
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
  const t = useTranslations("topluluk");
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
    (threadId: string, emoji: string, adding: boolean) => {
      const patch = (v: boolean) => (r: Extract<State, { status: "ready" }>) => ({
        ...r,
        items: r.items.map((it) =>
          it.type === "thread" && it.thread.id === threadId
            ? { ...it, thread: applyReaction(it.thread, emoji, v) }
            : it,
        ),
      });
      patchReady(patch(adding));
      const call = adding ? reactThread(threadId, emoji) : unreactThread(threadId, emoji);
      call.catch(() => patchReady(patch(!adding)));
    },
    [patchReady],
  );

  const onToggleCommentLike = useCallback(
    (postId: string, adding: boolean) => {
      const patch = (v: boolean) => (r: Extract<State, { status: "ready" }>) => ({
        ...r,
        items: r.items.map((it) =>
          it.type === "comment" && it.comment.id === postId
            ? {
                ...it,
                comment: {
                  ...it.comment,
                  myLiked: v,
                  likeCount: Math.max(0, it.comment.likeCount + (v ? 1 : -1)),
                },
              }
            : it,
        ),
      });
      patchReady(patch(adding));
      const call = adding ? likePost(postId, FORUM_LIKE_EMOJI) : unlikePost(postId, FORUM_LIKE_EMOJI);
      call.catch(() => patchReady(patch(!adding)));
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
                onToggleReaction={(emoji, adding) => onToggleReaction(it.thread.id, emoji, adding)}
                // Every item here is already saved — the only toggle is unsaving (drops the row).
                onToggleBookmark={() => onUnbookmarkThread(it.thread.id)}
                clickable
              />
            ) : (
              <CommentRow
                key={`c-${it.comment.id}`}
                comment={it.comment}
                onToggleLike={onToggleCommentLike}
                onToggleBookmark={(id) => onUnbookmarkComment(id)}
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

/** Optimistic like toggle on a saved thread. */
function applyReaction(
  thread: Extract<SavedFeedItem, { type: "thread" }>["thread"],
  emoji: string,
  adding: boolean,
) {
  const count = thread.reactionCounts[emoji] ?? 0;
  const counts = { ...thread.reactionCounts, [emoji]: Math.max(0, count + (adding ? 1 : -1)) };
  if (counts[emoji] === 0) delete counts[emoji];
  const mine = adding ? [...thread.myReactions, emoji] : thread.myReactions.filter((e) => e !== emoji);
  return { ...thread, reactionCounts: counts, myReactions: mine };
}

function Centered({ children, embedded }: { children: React.ReactNode; embedded?: boolean }) {
  const cls = "mx-auto flex min-h-[40vh] w-full max-w-2xl items-center justify-center px-5 py-8";
  const body = <p style={{ color: "var(--color-secondary)" }}>{children}</p>;
  return embedded ? <div className={cls}>{body}</div> : <main className={cls}>{body}</main>;
}
