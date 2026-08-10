"use client";

import type { KeyboardEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { CommentView, ThreadView } from "@mentor/types";
import { useRouter } from "@/i18n/navigation";
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
  onReplyCreated?: (comment: CommentView) => void;
}) {
  const t = useTranslations("community");
  const locale = useLocale();
  const router = useRouter();
  const { openQuickReply } = useCommunityQuickReply();
  const detailHref = {
    pathname: "/community/message/[threadId]",
    params: { threadId: thread.id },
  } as const;
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
          "flex cursor-pointer touch-manipulation items-start gap-3 border-b border-[#e7e9ee] bg-white p-4 transition-colors last:border-b-0 hover:bg-black/[0.015] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-focus-ring)] motion-reduce:transition-none sm:p-5",
      }
    : { className: "flex items-start gap-3 border-b border-[#e7e9ee] bg-white p-4 last:border-b-0 sm:p-5" };

  return (
    <div {...rowProps}>
      <div className="shrink-0">
        <AuthorLink username={thread.authorUsername}>
          <AuthorAvatar name={thread.authorName} size={40} src={thread.authorAvatarUrl} />
        </AuthorLink>
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

        {thread.title && (
          <h2 className="mt-4 text-[22px] font-extrabold leading-[1.2] tracking-[-0.025em] text-[#171a22] sm:text-[24px]">
            {thread.title}
          </h2>
        )}
        <p
          className={`${thread.title ? "mt-2 text-[#69707c]" : "mt-4 text-[#343945]"} whitespace-pre-wrap break-words text-[14px] leading-[1.55]`}
        >
          <MentionText text={thread.body} />
        </p>

        {thread.attachments.length > 0 && (
          <div className="mt-4">
            <AttachmentGallery attachments={thread.attachments} />
          </div>
        )}

        {(thread.tags?.length ?? 0) > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {thread.tags?.slice(0, 3).map((tag) => (
              <span key={tag.id} className="rounded-full bg-[#f3f4f6] px-2.5 py-1 text-[11px] font-semibold text-[#666d78]">
                #{tag.name}
              </span>
            ))}
          </div>
        )}

        {/* Action row — reaction palette + comment count · send (share link) · bookmark. */}
        <div className="mt-3 flex w-full flex-wrap items-center gap-1">
          <ReactionBar
            targetType="THREAD"
            targetId={thread.id}
            reactionCounts={thread.reactionCounts}
            myReactions={thread.myReactions}
            onChange={onToggleReaction}
          />

          <button
            type="button"
            aria-label={t("comment_total", { count: thread.commentCount })}
            className="community-post-action group/cmt flex min-h-11 min-w-11 items-center justify-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
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
            {thread.commentCount > 0 ? (
              <span className="text-[13px]">{thread.commentCount}</span>
            ) : null}
          </button>

          <SendButton href={detailHref} />
          <BookmarkButton bookmarked={thread.myBookmarked} onToggle={onToggleBookmark} />
        </div>

      </div>
    </div>
  );
}
