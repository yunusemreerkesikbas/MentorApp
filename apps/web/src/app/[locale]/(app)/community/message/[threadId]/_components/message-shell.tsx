"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { type CommentView, type ThreadDetail, type ThreadView, type ZoneView } from "@mentor/types";
import { ApiClientError } from "@mentor/api-client";
import { FormError } from "@/components/form";
import { CircularBackLink } from "@/components/circular-back-link";
import { replaceReaction } from "@/lib/forum-reactions";
import { trackCoachEvent, trackCommunityEvent } from "@/lib/analytics";
import {
  communityReturnPlaceholderKey,
  parseCommunityReturnContext,
} from "@/lib/community-coach-bridge";
import {
  bookmarkPost,
  bookmarkThread,
  getThreadDetail,
  isForumDisabled,
  listZones,
  postComment,
  reactPost,
  reactThread,
  unreactPost,
  unreactThread,
} from "@/lib/forum";
import type { AttachmentInput } from "@mentor/validation";
import { CommentRow } from "../../../_components/comment-row";
import { ThreadComposer } from "../../../[slug]/_components/thread-composer";
import { CommunityPostCard } from "../../../_components/community-post-card";
import { CommunityCoachBridge } from "../../../_components/community-coach-bridge";
import { PostDetailSkeleton } from "../../../_components/post-skeleton";
import { CommunityTrendRail } from "../../../_components/community-trend-rail";

type State =
  | { status: "loading" }
  | { status: "disabled" }
  | { status: "error"; message: string }
  | { status: "ready"; thread: ThreadView; comments: CommentView[]; zone: ZoneView | null };

/** Message detail (APP-017) — the thread + its top-level comments + a comment composer. */
export function MessageShell({ threadId }: { threadId: string }) {
  const t = useTranslations("community");
  const searchParams = useSearchParams();
  const highlightId = searchParams.get("highlight");
  const returnContext = parseCommunityReturnContext({
    composer: searchParams.get("composer"),
    intent: searchParams.get("intent"),
  });
  const [state, setState] = useState<State>({ status: "loading" });

  const apply = useCallback((detail: ThreadDetail, zone: ZoneView | null) => {
    setState({ status: "ready", thread: detail.thread, comments: detail.comments, zone });
  }, []);

  useEffect(() => {
    let active = true;
    Promise.all([getThreadDetail(threadId), listZones()])
      .then(([detail, zones]) => {
        if (active) {
          const zone = zones.items.find((entry) => entry.id === detail.thread.zoneId) ?? null;
          apply(detail, zone);
          trackCommunityEvent("forum_thread_view", {
            zone_type: zone?.type ?? "CHAT",
            answered: false,
          });
        }
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
    (nextEmoji: string | null, previousEmoji: string | null) => {
      setState((s) =>
        s.status === "ready" ? { ...s, thread: replaceReaction(s.thread, nextEmoji) } : s,
      );
      const call = nextEmoji
        ? reactThread(threadId, nextEmoji)
        : previousEmoji
          ? unreactThread(threadId, previousEmoji)
          : Promise.resolve();
      call.catch(() => {
        setState((s) =>
          s.status === "ready" ? { ...s, thread: replaceReaction(s.thread, previousEmoji) } : s,
        );
      });
    },
    [threadId],
  );

  const onToggleCommentReaction = useCallback((postId: string, nextEmoji: string | null, previousEmoji: string | null) => {
    const patch = (emoji: string | null) => (comment: CommentView) =>
      comment.id === postId ? replaceReaction(comment, emoji) : comment;
    setState((s) => (s.status === "ready" ? { ...s, comments: s.comments.map(patch(nextEmoji)) } : s));
    const call = nextEmoji
      ? reactPost(postId, nextEmoji)
      : previousEmoji
        ? unreactPost(postId, previousEmoji)
        : Promise.resolve();
    call.catch(() => {
      setState((s) => (s.status === "ready" ? { ...s, comments: s.comments.map(patch(previousEmoji)) } : s));
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
      const zoneType = state.status === "ready" ? state.zone?.type ?? "CHAT" : "CHAT";
      trackCommunityEvent("forum_reply_created", { target: "thread", zone_type: zoneType });
      if (returnContext) {
        trackCoachEvent("coach_community_return_reply_created", {
          intent: returnContext.intent,
          zone_type: "CHAT",
        });
      }
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
    [threadId, state, returnContext],
  );

  const changeThreadReplyCount = useCallback((delta: 1 | -1) => {
    setState((current) =>
      current.status === "ready"
        ? {
            ...current,
            thread: {
              ...current.thread,
              commentCount: Math.max(0, current.thread.commentCount + delta),
            },
          }
        : current,
    );
  }, []);

  const appendQuickComment = useCallback((created: CommentView) => {
    setState((current) =>
      current.status === "ready"
        ? { ...current, comments: [...current.comments, created] }
        : current,
    );
  }, []);

  const changeCommentReplyCount = useCallback((postId: string, delta: 1 | -1) => {
    setState((current) =>
      current.status === "ready"
        ? {
            ...current,
            comments: current.comments.map((comment) =>
              comment.id === postId
                ? { ...comment, replyCount: Math.max(0, comment.replyCount + delta) }
                : comment,
            ),
          }
        : current,
    );
  }, []);

  if (state.status === "loading") return <PostDetailSkeleton label={t("loading")} />;
  if (state.status === "disabled") return <Centered>{t("soon_title")}</Centered>;
  if (state.status === "error") {
    return (
      <main className="mx-auto w-full max-w-2xl px-4 py-6 lg:px-8">
        <FormError message={state.message} />
      </main>
    );
  }

  const { thread, comments, zone } = state;
  const backHref = zone
    ? ({ pathname: "/community/[slug]", params: { slug: zone.slug } } as const)
    : "/community";

  return (
    <main className="mx-auto grid min-w-0 max-w-[924px] items-start gap-6 xl:grid-cols-[600px_300px]">
      <section className="min-w-0 bg-white sm:my-6 sm:overflow-hidden sm:rounded-[var(--radius-card)] sm:border sm:border-[var(--color-border)]">
        <header className="flex min-h-16 items-center gap-3 border-b border-[var(--color-border)] px-3 sm:px-4">
          <CircularBackLink href={backHref} label={t("back_short")} variant="soft" />
          <h1 className="text-xl font-extrabold tracking-[-0.025em] text-[var(--color-main)]">
            {t("post_detail_title")}
          </h1>
        </header>

        <div className="border-b border-[var(--color-border)]">
        <CommunityPostCard
          thread={thread}
          onToggleReaction={onToggleThreadReaction}
          onToggleBookmark={onToggleThreadBookmark}
          onReplyCountChange={changeThreadReplyCount}
          onReplyCreated={appendQuickComment}
        />
        </div>

        <CommunityCoachBridge bridge={thread.coachBridge} />

        <div className="border-y border-[var(--color-border)]">
        <ThreadComposer
          placeholder={
            returnContext
              ? t(communityReturnPlaceholderKey(returnContext.intent))
              : t("comment_placeholder")
          }
          submitLabel={t("comment_submit")}
          onSubmit={onComment}
          zoneId={thread.zoneId}
          focusOnMount={Boolean(returnContext)}
        />
        </div>

        <h2 className="border-b border-[var(--color-border)] px-4 py-3 text-sm font-extrabold text-[var(--color-main)]">
          {t("comment_total", { count: comments.length })}
        </h2>

      {comments.length > 0 && (
          <div className="divide-y divide-[var(--color-border)]">
            {comments.map((c) => (
              <CommentRow
                key={c.id}
                comment={c}
                onToggleReaction={onToggleCommentReaction}
                onToggleBookmark={onToggleCommentBookmark}
                highlighted={c.id === highlightId}
                zoneId={thread.zoneId}
                onReplyCountChange={(delta) => changeCommentReplyCount(c.id, delta)}
              />
            ))}
          </div>
      )}
      </section>
      <div className="sticky top-20 hidden pt-6 xl:block">
        <CommunityTrendRail />
      </div>
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
