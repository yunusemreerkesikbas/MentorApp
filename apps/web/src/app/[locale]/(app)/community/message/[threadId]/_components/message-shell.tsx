"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { type CommentView, type ThreadDetail, type ThreadView, type ZoneView } from "@mentor/types";
import { ApiClientError } from "@mentor/api-client";
import { FormError } from "@/components/form";
import { useRouter } from "@/i18n/navigation";
import {
  PANEL_CARD_TITLE,
  PANEL_GRID_CLASS,
  PANEL_MAIN_CLASS,
} from "@/components/panel/panel-styles";
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
import { CommunityPresenceCard } from "../../../_components/community-presence";
import { COMMUNITY_CARD_FLUSH } from "../../../_components/community-row";
import { DetailCrumb } from "../../../_components/detail-crumb";
import { ZoneMiniCard } from "../../../_components/zone-mini-card";

type State =
  | { status: "loading" }
  | { status: "disabled" }
  | { status: "error"; message: string }
  | { status: "ready"; thread: ThreadView; comments: CommentView[]; zone: ZoneView | null };

/**
 * Message detail (APP-017) on the panel frame: the post card, then one card with "N yorum", the
 * composer and the comments; the rail shows the post's room and who is studying now.
 */
export function MessageShell({ threadId }: { threadId: string }) {
  const t = useTranslations("community");
  const router = useRouter();
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
      <main className={PANEL_MAIN_CLASS}>
        <FormError message={state.message} />
      </main>
    );
  }

  const { thread, comments, zone } = state;

  return (
    <main className={PANEL_MAIN_CLASS}>
      <h1 className="sr-only">{t("post_detail_title")}</h1>
      <DetailCrumb
        items={[
          { label: t("title"), href: "/community" },
          zone
            ? { label: zone.title, href: { pathname: "/community/[slug]", params: { slug: zone.slug } } }
            : null,
          { label: t("post_detail_title") },
        ]}
      />
      <div className={PANEL_GRID_CLASS}>
        <div className="flex min-w-0 flex-col gap-5">
          <div className={COMMUNITY_CARD_FLUSH}>
            <CommunityPostCard
              thread={thread}
              onToggleReaction={onToggleThreadReaction}
              onToggleBookmark={onToggleThreadBookmark}
              onReplyCountChange={changeThreadReplyCount}
              onReplyCreated={appendQuickComment}
              afterDelete={() =>
                router.replace(zone ? { pathname: "/community/[slug]", params: { slug: zone.slug } } : "/community")
              }
            />
          </div>

          <CommunityCoachBridge bridge={thread.coachBridge} />

          <section className={COMMUNITY_CARD_FLUSH} aria-labelledby="comments-title">
            <h2 id="comments-title" className={`${PANEL_CARD_TITLE} px-5 pt-5`}>
              {/* The thread's own count (replies included), the same number as on the post above. */}
              {t("comment_total", { count: thread.commentCount })}
            </h2>
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
            {comments.length > 0 ? (
              <div className="divide-y divide-[var(--color-border)] border-t border-[var(--color-border)]">
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
            ) : null}
          </section>
        </div>
        <aside className="flex min-w-0 flex-col gap-5" aria-label={t("zone_context_title")}>
          {zone ? <ZoneMiniCard zone={zone} /> : null}
          <CommunityPresenceCard />
        </aside>
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
