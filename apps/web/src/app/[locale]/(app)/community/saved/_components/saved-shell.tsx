"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { type SavedFeedItem } from "@mentor/types";
import { ApiClientError } from "@mentor/api-client";
import { Link } from "@/i18n/navigation";
import { CompanionBubble } from "@/components/panel/companion-bubble";
import {
  PANEL_CARD,
  PANEL_GRID_CLASS,
  PANEL_MAIN_CLASS,
  PANEL_QUIET_LINK,
  PANEL_TEXT_LINK,
} from "@/components/panel/panel-styles";
import { replaceReaction } from "@/lib/forum-reactions";
import { useMentorToast } from "@/lib/mentor-toast";
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
import { CommentRow } from "../../_components/comment-row";
import { CommunityPostCard } from "../../_components/community-post-card";
import { CommunityPresenceCard } from "../../_components/community-presence";
import { COMMUNITY_CARD_FLUSH } from "../../_components/community-row";
import { HubWaitingQuestions } from "../../_components/hub-waiting-questions";
import { PostListSkeleton } from "../../_components/post-skeleton";

type Ready = { status: "ready"; items: SavedFeedItem[]; nextCursor: string | null; loadingMore: boolean };
type State = { status: "loading" } | { status: "disabled" } | { status: "error"; message: string } | Ready;

const itemKey = (item: SavedFeedItem) => (item.type === "thread" ? `t-${item.thread.id}` : `c-${item.comment.id}`);

/**
 * Kaydedilenler: the viewer's saved posts and comments, newest-saved first, on the panel frame.
 * Unsaving drops the row at once and puts it back (with a toast) if the server says no.
 */
export function SavedShell() {
  const t = useTranslations("community");
  const toast = useMentorToast();
  const [state, setState] = useState<State>({ status: "loading" });
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let active = true;
    getBookmarks()
      .then((feed) => {
        if (active) setState({ status: "ready", ...feed, loadingMore: false });
      })
      .catch((err: unknown) => {
        if (!active) return;
        if (isForumDisabled(err)) return setState({ status: "disabled" });
        setState({ status: "error", message: err instanceof ApiClientError ? err.body.message : t("error") });
      });
    return () => {
      active = false;
    };
  }, [retry, t]);

  const patchReady = useCallback(
    (fn: (r: Ready) => Ready) => setState((s) => (s.status === "ready" ? fn(s) : s)),
    [],
  );

  const loadMore = () => {
    if (state.status !== "ready" || !state.nextCursor || state.loadingMore) return;
    const cursor = state.nextCursor;
    patchReady((r) => ({ ...r, loadingMore: true }));
    getBookmarks(cursor)
      .then((feed) =>
        patchReady((r) => ({ ...r, items: [...r.items, ...feed.items], nextCursor: feed.nextCursor, loadingMore: false })),
      )
      .catch(() => patchReady((r) => ({ ...r, loadingMore: false })));
  };

  const patchItem = (key: string, fn: (item: SavedFeedItem) => SavedFeedItem) =>
    patchReady((r) => ({ ...r, items: r.items.map((item) => (itemKey(item) === key ? fn(item) : item)) }));

  const onToggleThreadReaction = (threadId: string, nextEmoji: string | null, previousEmoji: string | null) => {
    const patch = (emoji: string | null) =>
      patchItem(`t-${threadId}`, (item) => (item.type === "thread" ? { ...item, thread: replaceReaction(item.thread, emoji) } : item));
    patch(nextEmoji);
    const call = nextEmoji ? reactThread(threadId, nextEmoji) : previousEmoji ? unreactThread(threadId, previousEmoji) : Promise.resolve();
    call.catch(() => patch(previousEmoji));
  };

  const onToggleCommentReaction = (postId: string, nextEmoji: string | null, previousEmoji: string | null) => {
    const patch = (emoji: string | null) =>
      patchItem(`c-${postId}`, (item) => (item.type === "comment" ? { ...item, comment: replaceReaction(item.comment, emoji) } : item));
    patch(nextEmoji);
    const call = nextEmoji ? reactPost(postId, nextEmoji) : previousEmoji ? unreactPost(postId, previousEmoji) : Promise.resolve();
    call.catch(() => patch(previousEmoji));
  };

  const onReplyCountChange = (key: string, delta: 1 | -1) =>
    patchItem(key, (item) =>
      item.type === "thread"
        ? { ...item, thread: { ...item.thread, commentCount: Math.max(0, item.thread.commentCount + delta) } }
        : { ...item, comment: { ...item.comment, replyCount: Math.max(0, item.comment.replyCount + delta) } },
    );

  /** Every row here is saved, so the bookmark only unsaves; a refused unsave puts the row back. */
  const unsave = (item: SavedFeedItem) => {
    if (state.status !== "ready") return;
    const key = itemKey(item);
    const index = state.items.findIndex((entry) => itemKey(entry) === key);
    // The row goes back in front of the one that followed it, wherever that one is by then
    // (other unsaves may have moved it); with none left, at the end.
    const nextKey = state.items[index + 1] ? itemKey(state.items[index + 1]!) : null;
    patchReady((r) => ({ ...r, items: r.items.filter((entry) => itemKey(entry) !== key) }));
    const call = item.type === "thread" ? bookmarkThread(item.thread.id, false) : bookmarkPost(item.comment.id, false);
    call.catch(() => {
      patchReady((r) => {
        const at = nextKey ? r.items.findIndex((entry) => itemKey(entry) === nextKey) : -1;
        const pos = at === -1 ? r.items.length : at;
        return { ...r, items: [...r.items.slice(0, pos), item, ...r.items.slice(pos)] };
      });
      toast.error({ title: t("action_failed") });
    });
  };

  return (
    <main className={PANEL_MAIN_CLASS}>
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-extrabold tracking-[-0.01em] text-[var(--color-main)] sm:text-display">
          {t("saved_title")}
        </h1>
        <p className="text-body-sm font-semibold text-[var(--color-secondary)]">{t("saved_subtitle")}</p>
      </div>
      <div className={PANEL_GRID_CLASS}>
        <section className="flex min-w-0 flex-col gap-4" aria-busy={state.status === "loading"}>
          {state.status === "loading" ? (
            <PostListSkeleton label={t("loading")} count={3} variant="card" />
          ) : state.status === "disabled" ? (
            <p className={`${PANEL_CARD} text-body-sm font-semibold text-[var(--color-secondary)]`}>{t("soon_title")}</p>
          ) : state.status === "error" ? (
            <div className={`${PANEL_CARD} flex flex-col items-start gap-1`}>
              <p className="text-body-sm font-semibold text-[var(--color-secondary)]">{state.message}</p>
              <button
                type="button"
                className={PANEL_QUIET_LINK}
                onClick={() => {
                  setState({ status: "loading" });
                  setRetry((n) => n + 1);
                }}
              >
                {t("refresh")}
              </button>
            </div>
          ) : state.items.length === 0 ? (
            <div className={`${PANEL_CARD} flex flex-col gap-3`}>
              <CompanionBubble puhu="encouraging" text={t("saved_empty")} />
              <Link href="/community/feed" className={`${PANEL_TEXT_LINK} self-start`}>
                {t("saved_go_feed")}
                <ChevronRight size={16} aria-hidden />
              </Link>
            </div>
          ) : (
            <>
              <div className={COMMUNITY_CARD_FLUSH}>
                {state.items.map((item) =>
                  item.type === "thread" ? (
                    <CommunityPostCard
                      key={itemKey(item)}
                      thread={item.thread}
                      onToggleReaction={(nextEmoji, previousEmoji) =>
                        onToggleThreadReaction(item.thread.id, nextEmoji, previousEmoji)
                      }
                      onToggleBookmark={() => unsave(item)}
                      onReplyCountChange={(delta) => onReplyCountChange(itemKey(item), delta)}
                      clickable
                    />
                  ) : (
                    // Comment rows draw no rule of their own; the list's hairline sits under each one.
                    <div key={itemKey(item)} className="border-b border-[var(--color-border)] last:border-b-0">
                      <CommentRow
                        comment={item.comment}
                        onToggleReaction={onToggleCommentReaction}
                        onToggleBookmark={() => unsave(item)}
                        onReplyCountChange={(delta) => onReplyCountChange(itemKey(item), delta)}
                      />
                    </div>
                  ),
                )}
              </div>
              {state.loadingMore ? (
                <PostListSkeleton label={t("loading")} count={2} variant="card" />
              ) : state.nextCursor ? (
                <button type="button" onClick={loadMore} className={`${PANEL_QUIET_LINK} self-center`}>
                  {t("saved_load_more")}
                </button>
              ) : null}
            </>
          )}
        </section>
        <aside className="flex min-w-0 flex-col gap-5" aria-label={t("hub_rail_label")}>
          <HubWaitingQuestions />
          <CommunityPresenceCard />
        </aside>
      </div>
    </main>
  );
}
