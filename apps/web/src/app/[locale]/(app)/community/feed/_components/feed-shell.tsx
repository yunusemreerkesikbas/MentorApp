"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import type { ThreadView } from "@mentor/types";
import { ApiClientError } from "@mentor/api-client";
import { Button } from "@mentor/ui";
import {
  bookmarkThread,
  getFollowingFeed,
  isForumDisabled,
  reactThread,
  unreactThread,
} from "@/lib/forum";
import { toggleReaction } from "@/lib/forum-reactions";
import { ThreadItem } from "../../[slug]/_components/thread-item";
import { FollowSuggestions } from "./follow-suggestions";

type Ready = {
  status: "ready";
  items: ThreadView[];
  nextCursor: string | null;
  loadingMore: boolean;
};
type State =
  | { status: "loading" }
  | { status: "disabled" }
  | { status: "error"; message: string }
  | Ready;

/**
 * The cross-zone "Akış" feed — threads by the people the viewer follows, newest first. Threads-only
 * (comments/answers out of scope). Empty state invites following people or waits for their first post.
 */
export function FeedShell() {
  const t = useTranslations("community");
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    let active = true;
    getFollowingFeed()
      .then((feed) => {
        if (active) setState({ status: "ready", items: feed.items, nextCursor: feed.nextCursor, loadingMore: false });
      })
      .catch((err: unknown) => {
        if (!active) return;
        if (isForumDisabled(err)) return setState({ status: "disabled" });
        setState({ status: "error", message: err instanceof ApiClientError ? err.body.message : t("error") });
      });
    return () => {
      active = false;
    };
  }, [t]);

  const patchReady = useCallback(
    (fn: (r: Ready) => Ready) => setState((s) => (s.status === "ready" ? fn(s) : s)),
    [],
  );

  // Silent refetch after following someone from the suggestions — their posts flow into the feed.
  const refetch = useCallback(() => {
    getFollowingFeed()
      .then((feed) =>
        setState({ status: "ready", items: feed.items, nextCursor: feed.nextCursor, loadingMore: false }),
      )
      .catch(() => {
        /* keep current view on a refetch failure */
      });
  }, []);

  const loadMore = useCallback(() => {
    setState((s) => {
      if (s.status !== "ready" || !s.nextCursor || s.loadingMore) return s;
      getFollowingFeed(s.nextCursor)
        .then((feed) =>
          patchReady((r) => ({ ...r, items: [...r.items, ...feed.items], nextCursor: feed.nextCursor, loadingMore: false })),
        )
        .catch(() => patchReady((r) => ({ ...r, loadingMore: false })));
      return { ...s, loadingMore: true };
    });
  }, [patchReady]);

  const onToggleReaction = useCallback(
    (threadId: string, emoji: string, adding: boolean) => {
      const patch = (v: boolean) => (r: Ready) => ({
        ...r,
        items: r.items.map((th) => (th.id === threadId ? toggleReaction(th, emoji, v) : th)),
      });
      patchReady(patch(adding));
      (adding ? reactThread(threadId, emoji) : unreactThread(threadId, emoji)).catch(() => patchReady(patch(!adding)));
    },
    [patchReady],
  );

  const onToggleBookmark = useCallback(
    (threadId: string, adding: boolean) => {
      const patch = (v: boolean) => (r: Ready) => ({
        ...r,
        items: r.items.map((th) => (th.id === threadId ? { ...th, myBookmarked: v } : th)),
      });
      patchReady(patch(adding));
      bookmarkThread(threadId, adding).catch(() => patchReady(patch(!adding)));
    },
    [patchReady],
  );

  return (
    <main className="mx-auto min-w-0 max-w-2xl px-0 py-0">
      <div className="border-b px-4 py-4 lg:px-6" style={{ borderColor: "rgba(0,0,0,0.08)" }}>
        <h1
          className="text-[20px] font-bold leading-tight"
          style={{ color: "var(--color-main)", fontFamily: "var(--font-heading)" }}
        >
          {t("feed_nav")}
        </h1>
      </div>

      <FollowSuggestions onFollowed={refetch} />

      {state.status === "loading" ? (
        <Centered>{t("loading")}</Centered>
      ) : state.status === "disabled" ? (
        <Centered>{t("soon_title")}</Centered>
      ) : state.status === "error" ? (
        <Centered>{state.message}</Centered>
      ) : state.items.length === 0 ? (
        <p className="px-4 py-16 text-center text-sm" style={{ color: "var(--color-secondary)" }}>
          {t("following_feed_empty")}
        </p>
      ) : (
        <>
          <div className="divide-y divide-[rgba(0,0,0,0.06)]">
            {state.items.map((thread) => (
              <ThreadItem
                key={thread.id}
                thread={thread}
                onToggleReaction={(emoji, adding) => onToggleReaction(thread.id, emoji, adding)}
                onToggleBookmark={(adding) => onToggleBookmark(thread.id, adding)}
                clickable
              />
            ))}
          </div>
          {state.nextCursor && (
            <div className="my-6 flex justify-center">
              <Button variant="secondary" busy={state.loadingMore} onClick={loadMore}>
                {t("saved_load_more")}
              </Button>
            </div>
          )}
        </>
      )}
    </main>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[30vh] items-center justify-center px-5 py-8">
      <p style={{ color: "var(--color-secondary)" }}>{children}</p>
    </div>
  );
}
