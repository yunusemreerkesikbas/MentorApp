"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { type AchievementCollectionDto, type ForumActivityItem, type PublicProfile } from "@mentor/types";
import { ApiClientError } from "@mentor/api-client";
import { Button, Skeleton, SkeletonGroup } from "@mentor/ui";
import { Link, useRouter } from "@/i18n/navigation";
import { FormError } from "@/components/form";
import { useAuth } from "@/lib/auth-context";
import { AchievementCollection } from "@/components/achievements/achievement-collection";
import { getProfileAchievements, getPublicProfile } from "@/lib/community";
import { sendBuddyRequest } from "@/lib/buddy";
import { followUser, unfollowUser } from "@/lib/follow";
import { useMentorToast } from "@/lib/mentor-toast";
import { replaceReaction } from "@/lib/forum-reactions";
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
import { CommunityPostCard } from "../../../_components/community-post-card";
import { SavedShell } from "../../../saved/_components/saved-shell";
import { FollowListPanel } from "./follow-list-panel";
import { ProfileHeader, ProfileProgressPanel } from "./profile-header";

type Ready = {
  status: "ready";
  profile: PublicProfile;
  items: ForumActivityItem[];
  nextCursor: string | null;
  loadingMore: boolean;
  achievements: AchievementCollectionDto | null;
};
type State =
  | { status: "loading" }
  | { status: "disabled" }
  | { status: "notfound" }
  | { status: "error"; message: string }
  | Ready;

/** A user's public forum profile — header (identity + gamification) + their activity feed. */
export function ProfileShell({ username }: { username: string }) {
  const t = useTranslations("community");
  const searchParams = useSearchParams();
  const router = useRouter();
  const { error: showErrorToast } = useMentorToast();
  const { user } = useAuth();
  const isOwn = !!user?.username && user.username === username;
  const tabParam = searchParams.get("tab");
  const requestedTab = tabParam === "achievements"
    ? "achievements"
    : ["bookmarks", "saved"].includes(tabParam ?? "")
      ? "bookmarks"
      : "posts";
  const [listView, setListView] = useState<"followers" | "following" | null>(null);
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    let active = true;
    getPublicProfile(username).then(async (profile) => {
      const effectiveTab = (requestedTab === "achievements" && !profile.achievementsEnabled)
        || (requestedTab === "bookmarks" && !isOwn)
        ? "posts"
        : requestedTab;
      const [feed, achievements] = await Promise.all([
        effectiveTab === "posts" ? getUserActivity(username) : Promise.resolve({ items: [], nextCursor: null }),
        effectiveTab === "achievements" ? getProfileAchievements(username) : Promise.resolve(null),
      ]);
        if (active) {
          setState({ status: "ready", profile, items: feed.items, nextCursor: feed.nextCursor, loadingMore: false, achievements });
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
  }, [isOwn, requestedTab, username, t]);

  const selectTab = (nextTab: "posts" | "achievements" | "bookmarks") => {
    router.push({
      pathname: "/community/member/[username]",
      params: { username },
      query: nextTab === "posts" ? {} : { tab: nextTab },
    });
  };

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
    (threadId: string, nextEmoji: string | null, previousEmoji: string | null) => {
      const patch = (emoji: string | null) => (r: Ready) => ({
        ...r,
        items: r.items.map((it) =>
          it.type === "thread" && it.thread.id === threadId ? { ...it, thread: replaceReaction(it.thread, emoji) } : it,
        ),
      });
      patchReady(patch(nextEmoji));
      (nextEmoji ? reactThread(threadId, nextEmoji) : previousEmoji ? unreactThread(threadId, previousEmoji) : Promise.resolve()).catch(() => patchReady(patch(previousEmoji)));
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
    (postId: string, nextEmoji: string | null, previousEmoji: string | null) => {
      const patch = (emoji: string | null) => (r: Ready) => ({
        ...r,
        items: r.items.map((it) =>
          it.type === "comment" && it.comment.id === postId
            ? { ...it, comment: replaceReaction(it.comment, emoji) }
            : it,
        ),
      });
      patchReady(patch(nextEmoji));
      (nextEmoji ? reactPost(postId, nextEmoji) : previousEmoji ? unreactPost(postId, previousEmoji) : Promise.resolve()).catch(() => patchReady(patch(previousEmoji)));
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

  const onReplyCountChange = useCallback(
    (type: ForumActivityItem["type"], id: string, delta: 1 | -1) => {
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

  if (state.status === "disabled") return <Centered>{t("soon_title")}</Centered>;
  if (state.status === "notfound") return <Centered>{t("profile_not_found")}</Centered>;
  if (state.status === "error") {
    return (
      <main className="mx-auto w-full max-w-2xl px-4 py-6 lg:px-8">
        <FormError message={state.message} />
      </main>
    );
  }

  const loading = state.status === "loading";
  const ready = state.status === "ready" ? state : null;
  const profile = ready?.profile ?? null;
  const items = ready?.items ?? [];
  const nextCursor = ready?.nextCursor ?? null;
  const loadingMore = ready?.loadingMore ?? false;
  const achievements = ready?.achievements ?? null;
  const tab =
    profile == null
      ? "posts"
      : (requestedTab === "achievements" && !profile.achievementsEnabled) ||
          (requestedTab === "bookmarks" && !isOwn)
        ? "posts"
        : requestedTab;
  const profileTabs: Array<"posts" | "achievements" | "bookmarks"> =
    profile == null
      ? ["posts"]
      : isOwn
        ? ["posts", ...(profile.achievementsEnabled ? ["achievements" as const] : []), "bookmarks"]
        : ["posts", ...(profile.achievementsEnabled ? ["achievements" as const] : [])];

  const readyBody =
    profile == null ? (
      <div className="min-h-[28rem]" aria-hidden />
    ) : (
      <div className="grid min-w-0 items-start gap-6 xl:grid-cols-[600px_300px]">
        <section className="min-w-0 bg-[var(--color-surface)]">
          <ProfileHeader
            key={profile.userId}
            profile={profile}
            isOwn={isOwn}
            onToggleFollow={onToggleFollow}
            onBuddyRequest={onBuddyRequest}
            onOpenFollowers={() => setListView("followers")}
            onOpenFollowing={() => setListView("following")}
          />

          <div className="profile-progress-mobile px-4 pb-4 xl:hidden">
            <div className="relative z-10">
              <ProfileProgressPanel profile={profile} isOwner={isOwn} />
            </div>
          </div>

          {listView ? (
            <FollowListPanel
              key={listView}
              username={username}
              kind={listView}
              onBack={() => setListView(null)}
            />
          ) : (
            <>
              {/* Achievements are public; saved items remain private to the profile owner. */}
              <div
                className="flex gap-1 border-b px-4 lg:px-6"
                style={{ borderColor: "var(--color-border)" }}
              >
                {profileTabs.map((k) => {
                  const active = tab === k;
                  return (
                    <button
                      key={k}
                      type="button"
                      onClick={() => selectTab(k)}
                      aria-current={active ? "page" : undefined}
                      className="relative -mb-px px-3 py-3 text-[14px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
                      style={{
                        color: active ? "var(--color-main)" : "var(--color-secondary)",
                      }}
                    >
                      {k === "posts"
                        ? t("profile_tab_posts")
                        : k === "achievements"
                          ? t("profile_tab_achievements")
                          : t("saved_nav")}
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

              {isOwn && tab === "bookmarks" ? (
                <SavedShell embedded />
              ) : tab === "achievements" && achievements ? (
                <AchievementCollection collection={achievements} />
              ) : items.length === 0 ? (
                <p
                  className="px-4 py-12 text-center text-sm"
                  style={{ color: "var(--color-secondary)" }}
                >
                  {t("profile_activity_empty")}
                </p>
              ) : (
                <>
                  <div className="divide-y divide-[var(--color-border)]">
                    {items.map((it) => {
                      const key = it.type === "thread" ? `t-${it.thread.id}` : `c-${it.comment.id}`;
                      return (
                        <div key={key}>
                          {it.zone.title && (
                            <Link
                              href={{
                                pathname: "/community/[slug]",
                                params: { slug: it.zone.slug },
                              }}
                              className="inline-block px-3 pt-3 text-[11px] font-semibold hover:underline"
                              style={{ color: "var(--color-accent)" }}
                            >
                              {it.zone.title}
                            </Link>
                          )}
                          {it.type === "thread" ? (
                            <CommunityPostCard
                              thread={it.thread}
                              onToggleReaction={(nextEmoji, previousEmoji) =>
                                onToggleReaction(it.thread.id, nextEmoji, previousEmoji)
                              }
                              onToggleBookmark={(adding) =>
                                onToggleThreadBookmark(it.thread.id, adding)
                              }
                              onReplyCountChange={(delta) =>
                                onReplyCountChange("thread", it.thread.id, delta)
                              }
                              clickable
                            />
                          ) : (
                            // A reply opens its PARENT post with itself highlighted — so its context shows,
                            // not the reply stranded on its own detail page.
                            <CommentRow
                              comment={it.comment}
                              onToggleReaction={onToggleCommentReaction}
                              onToggleBookmark={onToggleCommentBookmark}
                              onReplyCountChange={(delta) =>
                                onReplyCountChange("comment", it.comment.id, delta)
                              }
                              rowHref={
                                it.comment.parentPostId
                                  ? {
                                      pathname: "/community/comment/[postId]",
                                      params: { postId: it.comment.parentPostId },
                                      query: { highlight: it.comment.id },
                                    }
                                  : {
                                      pathname: "/community/message/[threadId]",
                                      params: { threadId: it.comment.threadId },
                                      query: { highlight: it.comment.id },
                                    }
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
        </section>

        <aside className="sticky top-20 hidden xl:block">
          <ProfileProgressPanel profile={profile} isOwner={isOwn} />
        </aside>
      </div>
    );

  return (
    <main className="mx-auto w-full min-w-0 max-w-[924px]">
      <SkeletonGroup label={t("loading")} loading={loading} revealed={readyBody}>
        <ProfileSkeletonBlocks />
      </SkeletonGroup>
    </main>
  );
}

function ProfileSkeletonBlocks() {
  return (
    <div className="grid min-w-0 items-start gap-6 xl:grid-cols-[600px_300px]">
      <div className="overflow-hidden bg-[var(--color-surface)] sm:border-x sm:border-[var(--color-border)]">
        <Skeleton className="h-[min(52dvh,440px)] w-full rounded-none sm:h-[420px]" />
        <div className="flex justify-center gap-3 px-4 py-5">
          <Skeleton className="size-11 rounded-full" />
          <Skeleton className="h-11 w-40 rounded-full" />
          <Skeleton className="size-11 rounded-full" />
        </div>
        <div className="border-t border-[var(--color-border)] px-4 py-4">
          <Skeleton className="h-4 w-36 rounded-full" />
        </div>
      </div>
      <Skeleton className="hidden h-[360px] rounded-[var(--radius-card)] xl:block" />
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-[40vh] w-full max-w-2xl items-center justify-center px-5 py-8">
      <p style={{ color: "var(--color-secondary)" }}>{children}</p>
    </main>
  );
}
