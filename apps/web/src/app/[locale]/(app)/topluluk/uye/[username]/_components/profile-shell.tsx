"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { type ForumActivityItem, type PublicProfile } from "@mentor/types";
import { ApiClientError } from "@mentor/api-client";
import { Button } from "@mentor/ui";
import { Link } from "@/i18n/navigation";
import { FormError } from "@/components/form";
import { useAuth } from "@/lib/auth-context";
import { getPublicProfile } from "@/lib/community";
import { sendBuddyRequest } from "@/lib/buddy";
import { followUser, unfollowUser } from "@/lib/follow";
import { useMentorToast } from "@/lib/mentor-toast";
import { toggleReaction } from "@/lib/forum-reactions";
import {
  bookmarkPost,
  bookmarkThread,
  getUserActivity,
  isForumDisabled,
  reactPost,
  reactThread,
  unreactPost,
  unreactThread,
} from "@/lib/forum";
import { CommentRow } from "../../../_components/comment-row";
import { ThreadItem } from "../../../[slug]/_components/thread-item";
import { SavedShell } from "../../../kayitli/_components/saved-shell";
import { FollowListPanel } from "./follow-list-panel";
import { ProfileHeader } from "./profile-header";

type Ready = {
  status: "ready";
  profile: PublicProfile;
  items: ForumActivityItem[];
  nextCursor: string | null;
  loadingMore: boolean;
};
type State =
  | { status: "loading" }
  | { status: "disabled" }
  | { status: "notfound" }
  | { status: "error"; message: string }
  | Ready;

/** A user's public forum profile — header (identity + gamification) + their activity feed. */
export function ProfileShell({ username }: { username: string }) {
  const t = useTranslations("topluluk");
  const { error: showErrorToast } = useMentorToast();
  const { user } = useAuth();
  const isOwn = !!user?.username && user.username === username;
  const [tab, setTab] = useState<"posts" | "saved">("posts");
  const [listView, setListView] = useState<"followers" | "following" | null>(null);
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    let active = true;
    Promise.all([getPublicProfile(username), getUserActivity(username)])
      .then(([profile, feed]) => {
        if (active) {
          setState({ status: "ready", profile, items: feed.items, nextCursor: feed.nextCursor, loadingMore: false });
        }
      })
      .catch((err: unknown) => {
        if (!active) return;
        if (isForumDisabled(err)) return setState({ status: "disabled" });
        if (err instanceof ApiClientError && err.status === 404) return setState({ status: "notfound" });
        setState({ status: "error", message: err instanceof ApiClientError ? err.body.message : t("error") });
      });
    return () => {
      active = false;
    };
  }, [username, t]);

  const patchReady = useCallback(
    (fn: (r: Ready) => Ready) => setState((s) => (s.status === "ready" ? fn(s) : s)),
    [],
  );

  const loadMore = useCallback(() => {
    setState((s) => {
      if (s.status !== "ready" || !s.nextCursor || s.loadingMore) return s;
      getUserActivity(username, s.nextCursor)
        .then((feed) =>
          patchReady((r) => ({ ...r, items: [...r.items, ...feed.items], nextCursor: feed.nextCursor, loadingMore: false })),
        )
        .catch(() => patchReady((r) => ({ ...r, loadingMore: false })));
      return { ...s, loadingMore: true };
    });
  }, [patchReady, username]);

  const onToggleReaction = useCallback(
    (threadId: string, emoji: string, adding: boolean) => {
      const patch = (v: boolean) => (r: Ready) => ({
        ...r,
        items: r.items.map((it) =>
          it.type === "thread" && it.thread.id === threadId ? { ...it, thread: toggleReaction(it.thread, emoji, v) } : it,
        ),
      });
      patchReady(patch(adding));
      (adding ? reactThread(threadId, emoji) : unreactThread(threadId, emoji)).catch(() => patchReady(patch(!adding)));
    },
    [patchReady],
  );

  const onToggleThreadBookmark = useCallback(
    (threadId: string, adding: boolean) => {
      const patch = (v: boolean) => (r: Ready) => ({
        ...r,
        items: r.items.map((it) =>
          it.type === "thread" && it.thread.id === threadId ? { ...it, thread: { ...it.thread, myBookmarked: v } } : it,
        ),
      });
      patchReady(patch(adding));
      bookmarkThread(threadId, adding).catch(() => patchReady(patch(!adding)));
    },
    [patchReady],
  );

  const onToggleCommentReaction = useCallback(
    (postId: string, emoji: string, adding: boolean) => {
      const patch = (v: boolean) => (r: Ready) => ({
        ...r,
        items: r.items.map((it) =>
          it.type === "comment" && it.comment.id === postId
            ? { ...it, comment: toggleReaction(it.comment, emoji, v) }
            : it,
        ),
      });
      patchReady(patch(adding));
      (adding ? reactPost(postId, emoji) : unreactPost(postId, emoji)).catch(() => patchReady(patch(!adding)));
    },
    [patchReady],
  );

  const onToggleCommentBookmark = useCallback(
    (postId: string, adding: boolean) => {
      const patch = (v: boolean) => (r: Ready) => ({
        ...r,
        items: r.items.map((it) =>
          it.type === "comment" && it.comment.id === postId ? { ...it, comment: { ...it.comment, myBookmarked: v } } : it,
        ),
      });
      patchReady(patch(adding));
      bookmarkPost(postId, adding).catch(() => patchReady(patch(!adding)));
    },
    [patchReady],
  );

  /** Optimistic follow toggle — flips isFollowing + follower count, reverts on failure. */
  const onToggleFollow = useCallback(() => {
    setState((s) => {
      if (s.status !== "ready") return s;
      const adding = !s.profile.isFollowing;
      const step = (add: boolean) => (r: Ready) => ({
        ...r,
        profile: {
          ...r.profile,
          isFollowing: add,
          followerCount: Math.max(0, r.profile.followerCount + (add ? 1 : -1)),
        },
      });
      (adding ? followUser(username) : unfollowUser(username)).catch(() =>
        patchReady(step(!adding)),
      );
      return step(adding)(s);
    });
  }, [patchReady, username]);

  /** Optimistic buddy request — flips to pending_outgoing, reverts + toasts on failure. */
  const onBuddyRequest = useCallback(() => {
    const step = (status: PublicProfile["buddyStatus"]) => (r: Ready) => ({
      ...r,
      profile: { ...r.profile, buddyStatus: status },
    });
    patchReady(step("pending_outgoing"));
    sendBuddyRequest(username).catch((err: unknown) => {
      patchReady(step("none"));
      showErrorToast({
        title: t("buddy_request_error_title"),
        message: err instanceof ApiClientError ? err.body.message : undefined,
        duration: 3000,
      });
    });
  }, [patchReady, showErrorToast, t, username]);

  if (state.status === "loading") return <Centered>{t("loading")}</Centered>;
  if (state.status === "disabled") return <Centered>{t("soon_title")}</Centered>;
  if (state.status === "notfound") return <Centered>{t("profile_not_found")}</Centered>;
  if (state.status === "error") {
    return (
      <main className="mx-auto w-full max-w-2xl px-4 py-6 lg:px-8">
        <FormError message={state.message} />
      </main>
    );
  }

  const { profile, items, nextCursor, loadingMore } = state;

  return (
    <main className="mx-auto min-w-0 max-w-2xl px-0 py-0">
      <div className="px-4 pt-4 lg:px-6">
        <Link
          href="/topluluk"
          className="inline-flex items-center gap-1 text-sm transition-opacity hover:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
          style={{ color: "var(--color-secondary)" }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="15 18 9 12 15 6" /></svg>
          {t("back")}
        </Link>
      </div>
      <ProfileHeader
        profile={profile}
        isOwn={isOwn}
        onToggleFollow={onToggleFollow}
        onBuddyRequest={onBuddyRequest}
        onOpenFollowers={() => setListView("followers")}
        onOpenFollowing={() => setListView("following")}
      />

      {listView ? (
        <FollowListPanel
          key={listView}
          username={username}
          kind={listView}
          onBack={() => setListView(null)}
        />
      ) : (
        <>
      {/* Tabs — only on your own profile, where "Kaydedilenler" (private) is meaningful. */}
      {isOwn && (
        <div className="flex gap-1 border-b px-4 lg:px-6" style={{ borderColor: "rgba(0,0,0,0.08)" }}>
          {(["posts", "saved"] as const).map((k) => {
            const active = tab === k;
            return (
              <button
                key={k}
                type="button"
                onClick={() => setTab(k)}
                aria-current={active ? "page" : undefined}
                className="relative -mb-px px-3 py-3 text-[14px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
                style={{ color: active ? "var(--color-main)" : "var(--color-secondary)" }}
              >
                {k === "posts" ? t("profile_tab_posts") : t("saved_nav")}
                {active && (
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-2 -bottom-px h-0.5 rounded-full"
                    style={{ background: "var(--color-accent)" }}
                  />
                )}
              </button>
            );
          })}
        </div>
      )}

      {isOwn && tab === "saved" ? (
        <div className="px-4 pt-4 lg:px-6">
          <SavedShell embedded />
        </div>
      ) : items.length === 0 ? (
        <p className="px-4 py-12 text-center text-sm" style={{ color: "var(--color-secondary)" }}>
          {t("profile_activity_empty")}
        </p>
      ) : (
        <>
          <div className="divide-y divide-[rgba(0,0,0,0.06)]">
            {items.map((it) => {
              const key = it.type === "thread" ? `t-${it.thread.id}` : `c-${it.comment.id}`;
              return (
                <div key={key}>
                  {it.zone.title && (
                    <Link
                      href={`/topluluk/${it.zone.slug}`}
                      className="inline-block px-3 pt-3 text-[11px] font-semibold hover:underline"
                      style={{ color: "var(--color-accent)" }}
                    >
                      {it.zone.title}
                    </Link>
                  )}
                  {it.type === "thread" ? (
                    <ThreadItem
                      thread={it.thread}
                      onToggleReaction={(emoji, adding) => onToggleReaction(it.thread.id, emoji, adding)}
                      onToggleBookmark={(adding) => onToggleThreadBookmark(it.thread.id, adding)}
                      clickable
                    />
                  ) : (
                    // A reply opens its PARENT post with itself highlighted — so its context shows,
                    // not the reply stranded on its own detail page.
                    <CommentRow
                      comment={it.comment}
                      onToggleReaction={onToggleCommentReaction}
                      onToggleBookmark={onToggleCommentBookmark}
                      rowHref={
                        it.comment.parentPostId
                          ? `/topluluk/yorum/${it.comment.parentPostId}?highlight=${it.comment.id}`
                          : `/topluluk/mesaj/${it.comment.threadId}?highlight=${it.comment.id}`
                      }
                    />
                  )}
                </div>
              );
            })}
          </div>

          {nextCursor && (
            <div className="my-6 flex justify-center">
              <Button variant="secondary" busy={loadingMore} onClick={loadMore}>
                {t("saved_load_more")}
              </Button>
            </div>
          )}
        </>
      )}
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
