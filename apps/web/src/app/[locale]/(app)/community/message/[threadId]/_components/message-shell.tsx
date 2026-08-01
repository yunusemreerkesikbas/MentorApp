"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import Users from "lucide-react/dist/esm/icons/users.mjs";
import { type CommentView, type ThreadDetail, type ThreadView, type ZoneView } from "@mentor/types";
import { ApiClientError } from "@mentor/api-client";
import { Link } from "@/i18n/navigation";
import { FormError } from "@/components/form";
import { toggleReaction } from "@/lib/forum-reactions";
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
import { ThreadItem } from "../../../[slug]/_components/thread-item";
import { CommunityCoachBridge } from "../../../_components/community-coach-bridge";

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

  if (state.status === "loading") return <Centered>{t("loading")}</Centered>;
  if (state.status === "disabled") return <Centered>{t("soon_title")}</Centered>;
  if (state.status === "error") {
    return (
      <main className="mx-auto w-full max-w-2xl px-4 py-6 lg:px-8">
        <FormError message={state.message} />
      </main>
    );
  }

  const { thread, comments, zone } = state;
  const participantNames = Array.from(
    new Set([thread.authorName, ...thread.commenterNames, ...comments.map((comment) => comment.authorName)]),
  ).slice(0, 8);

  return (
    <main className="mx-auto min-w-0 max-w-[1180px] px-4 py-5 sm:px-7 lg:px-8 lg:py-6">
      <nav aria-label={t("breadcrumb_label")} className="mb-5 flex min-h-11 flex-wrap items-center gap-2 border-b border-[#e7e9ee] pb-4 text-[13px] text-[#7b808a]">
        <Link href="/community" className="font-semibold text-[#373c47] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]">
          {t("title")}
        </Link>
        <span aria-hidden="true">›</span>
        {zone ? (
          <Link
            href={{ pathname: "/community/[slug]", params: { slug: zone.slug } }}
            className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
          >
            {zone.title}
          </Link>
        ) : (
          <span>{t("type_chat")}</span>
        )}
        <span aria-hidden="true">›</span>
        <span aria-current="page" className="max-w-[24rem] truncate text-[#222630]">
          {thread.title ?? thread.body.slice(0, 52)}
        </span>
      </nav>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_304px]">
      <div className="min-w-0">

      {/* Main thread */}
      <div className="overflow-hidden rounded-[14px] border border-[#e5e7ec] bg-white shadow-[0_2px_8px_rgb(18_24_39_/_3%)]">
        <ThreadItem
          thread={thread}
          onToggleReaction={onToggleThreadReaction}
          onToggleBookmark={onToggleThreadBookmark}
        />
      </div>

      <CommunityCoachBridge bridge={thread.coachBridge} />

      <h2 className="mb-3 mt-8 text-[20px] font-extrabold tracking-[-0.025em] text-[#1b1f28]">
        {t("comment_total", { count: comments.length })}
      </h2>
      <div className="rounded-[13px] border border-[#e3e6ea] bg-white">
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

      {/* Comments (nothing shown when empty — the composer above is the call to action) */}
      {comments.length > 0 && (
        <>
          <div className="mt-5 divide-y divide-[#eceef2] border-t border-[#eceef2]">
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
      </div>
      <aside className="hidden border-l border-[#e7e9ee] pl-5 xl:block" aria-label={t("detail_context_title")}>
        <h2 className="flex items-center gap-2 text-[13px] font-extrabold text-[#4c535f]"><Users size={16} className="text-[var(--community-blue-ink)]" aria-hidden />{t("detail_participants")}</h2>
        <div className="mt-3 grid gap-1">
          {participantNames.map((name) => (
            <span key={name} className="min-h-11 rounded-[9px] px-3 py-3 text-sm font-semibold text-[#343945] hover:bg-white">
              {name}
            </span>
          ))}
        </div>
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
