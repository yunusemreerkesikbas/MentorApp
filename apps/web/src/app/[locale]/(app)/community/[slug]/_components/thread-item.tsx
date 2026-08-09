"use client";

import type { KeyboardEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { ThreadView } from "@mentor/types";
import { Link, useRouter } from "@/i18n/navigation";
import { relativeTime } from "@/lib/relative-time";
import { AuthorAvatar } from "../../_components/author-avatar";
import { AuthorLink } from "../../_components/author-link";
import { AttachmentGallery } from "../../_components/attachment-gallery";
import { CommentIcon } from "../../_components/forum-icons";
import { MentionText } from "../../_components/mention-text";
import { ReactionBar } from "../../_components/reaction-bar";
import { SendButton } from "../../_components/send-button";
import { BookmarkButton } from "../../_components/bookmark-button";
import { useCommunityQuickReply } from "../../_components/community-quick-reply";
import { ThreadMenu } from "./thread-menu";

export function ThreadItem({
  thread,
  onToggleReaction,
  onToggleBookmark,
  canModerate,
  onPin,
  onDelete,
  clickable = false,
  onReplyCountChange,
  onReplyCreated,
}: {
  thread: ThreadView;
  onToggleReaction: (nextEmoji: string | null, previousEmoji: string | null) => void;
  onToggleBookmark: (adding: boolean) => void;
  canModerate?: boolean;
  onPin?: (pinned: boolean) => void;
  onDelete?: () => void;
  /** Feed rows open the post detail on click (Twitter-style); the detail page's own thread doesn't. */
  clickable?: boolean;
  onReplyCountChange?: (delta: 1 | -1) => void;
  onReplyCreated?: (comment: import("@mentor/types").CommentView) => void;
}) {
  const t = useTranslations("community");
  const locale = useLocale();
  const router = useRouter();
  const { openQuickReply } = useCommunityQuickReply();
  const detailHref = {
    pathname: "/community/message/[threadId]",
    params: { threadId: thread.id },
  } as const;
  const repliers = thread.commenterNames.slice(0, 3);

  // Reaction counts live in the ReactionBar chips now; the summary keeps only the comment total.
  const summary: string[] = [];
  if (thread.commentCount > 0) summary.push(t("comment_total", { count: thread.commentCount }));

  // Twitter-style row: the whole post navigates to its detail; interactive children stop propagation.
  const open = () => router.push(detailHref);
  const onRowKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      open();
    }
  };
  const rowProps = clickable
    ? {
        role: "link" as const,
        tabIndex: 0,
        onClick: open,
        onKeyDown: onRowKeyDown,
        className:
          "flex cursor-pointer touch-manipulation items-stretch gap-3 py-4 pl-3 pr-4 transition-colors hover:bg-black/[0.015] focus-visible:outline-none focus-visible:bg-black/[0.02]",
      }
    : { className: "flex items-stretch gap-3 py-4 pl-3 pr-4" };

  return (
    <div {...rowProps}>
      {/* Avatar column + connector rail down to the replier cluster (Figma 1:282/1:285) */}
      <div className="flex flex-col items-center">
        <AuthorLink username={thread.authorUsername}>
          <AuthorAvatar name={thread.authorName} size={36} src={thread.authorAvatarUrl} />
        </AuthorLink>
        {repliers.length > 0 && (
          <>
            <div className="mt-2 w-px flex-1" style={{ background: "rgba(0,0,0,0.10)" }} aria-hidden="true" />
            <div className="mt-2 flex" aria-hidden="true">
              {repliers.map((name, i) => (
                <span
                  key={`${name}-${i}`}
                  className="inline-flex rounded-full ring-2 ring-white"
                  style={{ marginLeft: i === 0 ? 0 : -8 }}
                >
                  <AuthorAvatar name={name} size={20} />
                </span>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="min-w-0 flex-1">
        {/* Header row — name truncates so the timestamp + menu never wrap on narrow screens */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-1.5">
            <AuthorLink
              username={thread.authorUsername}
              className="flex-shrink truncate text-[15px] font-semibold hover:underline"
            >
              <span style={{ color: "var(--color-main)" }}>{thread.authorName || t("unknown_author")}</span>
            </AuthorLink>
            {thread.authorUsername && (
              <span className="flex-shrink truncate text-[13px]" style={{ color: "var(--color-secondary)" }}>
                @{thread.authorUsername}
              </span>
            )}
            {thread.isPinned && (
              <span
                className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                style={{
                  background: "color-mix(in srgb, var(--color-chip) 20%, white)",
                  color: "var(--color-chip-text)",
                }}
              >
                {t("pinned")}
              </span>
            )}
          </div>
          <div className="flex flex-shrink-0 items-center gap-2">
            <span className="whitespace-nowrap text-xs" style={{ color: "var(--color-secondary)" }}>
              {relativeTime(thread.createdAt, locale)}
            </span>
            {/* Menu owns its own clicks — don't let them trigger the row navigation. */}
            <span onClick={(e) => e.stopPropagation()}>
              <ThreadMenu
                targetId={thread.id}
                isPinned={thread.isPinned}
                canModerate={canModerate}
                onPin={onPin}
                onDelete={onDelete}
              />
            </span>
          </div>
        </div>

        {/* Body */}
        <p
          className="mt-1 whitespace-pre-wrap break-words text-[15px] leading-[22px]"
          style={{ color: "var(--color-body)" }}
        >
          <MentionText text={thread.body} />
        </p>

        <AttachmentGallery attachments={thread.attachments} />

        {/* Action row — reaction palette + comment · send (share link) · bookmark. Reaction counts
            render as chips inside the ReactionBar; the summary line below keeps the comment total. */}
        <div className="mt-2 flex w-full flex-wrap items-center justify-between gap-1">
          <ReactionBar
            reactionCounts={thread.reactionCounts}
            myReactions={thread.myReactions}
            onChange={onToggleReaction}
          />

          <button
            type="button"
            aria-label={t("comment")}
            className="community-post-action group/cmt flex size-11 items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
            style={{ color: "var(--color-main)" }}
            onClick={(e) => {
              e.stopPropagation();
              openQuickReply({
                targetType: "thread",
                targetId: thread.id,
                zoneId: thread.zoneId,
                author: {
                  displayName: thread.authorName,
                  username: thread.authorUsername,
                  avatarUrl: thread.authorAvatarUrl,
                },
                createdAt: thread.createdAt,
                body: thread.body,
                attachments: thread.attachments,
                onPendingChange: onReplyCountChange,
                onCreated: onReplyCreated,
              });
            }}
          >
            <span className="inline-flex">
              <CommentIcon />
            </span>
          </button>

          <SendButton href={detailHref} />
          <BookmarkButton bookmarked={thread.myBookmarked} onToggle={onToggleBookmark} />
        </div>

        {/* Summary line (Figma 1:305 "7 respostas · 59 curtidas") */}
        {summary.length > 0 && (
          <p className="mt-1.5 text-[13px] tracking-[-0.2px]" style={{ color: "var(--color-secondary)" }}>
            {summary.join(" · ")}
          </p>
        )}
      </div>
    </div>
  );
}
