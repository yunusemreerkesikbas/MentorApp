"use client";
import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import type { CommentView, ThreadDetail, ThreadView, ZoneView } from "@mentor/types";
import type { AttachmentInput } from "@mentor/validation";
import { ApiClientError } from "@mentor/api-client";
import { replaceReaction } from "@/lib/forum-reactions";
import { trackCoachEvent, trackCommunityEvent } from "@/lib/analytics";
import type { parseCommunityReturnContext } from "@/lib/community-coach-bridge";
import { bookmarkPost, bookmarkThread, getThreadDetail, isForumDisabled, listZones, postComment, reactPost, reactThread, unreactPost, unreactThread } from "@/lib/forum";

type State =
  | { status: "loading" }
  | { status: "disabled" }
  | { status: "error"; message: string }
  | { status: "ready"; thread: ThreadView; comments: CommentView[]; zone: ZoneView | null; adContext?: ThreadDetail["adContext"] };


export function useMessageDetail(threadId: string, returnContext: ReturnType<typeof parseCommunityReturnContext>) {
  const t = useTranslations("community");
  const [state, setState] = useState<State>({ status: "loading" });

  const apply = useCallback((detail: ThreadDetail, zone: ZoneView | null) => {
    setState({ status: "ready", thread: detail.thread, comments: detail.comments, zone: detail.adContext?.zone ?? zone, adContext: detail.adContext });
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
              adContext: undefined,
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
            adContext: undefined,
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
        ? { ...current, adContext: undefined, comments: [...current.comments, created] }
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
            adContext: undefined,
          }
        : current,
    );
  }, []);


  return { state, onToggleThreadReaction, onToggleThreadBookmark, onToggleCommentReaction, onToggleCommentBookmark, onComment, changeThreadReplyCount, appendQuickComment, changeCommentReplyCount };
}
