"use client";

import { useEffect, useRef, type KeyboardEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ModerationTargetType, type CommentView } from "@mentor/types";
import { useRouter } from "@/i18n/navigation";
import { relativeTime } from "@/lib/relative-time";
import { AuthorAvatar } from "./author-avatar";
import { AuthorLink } from "./author-link";
import { AttachmentGallery } from "./attachment-gallery";
import { CommentIcon } from "./forum-icons";
import { MentionText } from "./mention-text";
import { ReactionBar } from "./reaction-bar";
import { SendButton, type ShareHref } from "./send-button";
import { BookmarkButton } from "./bookmark-button";
import { ThreadMenu } from "../[slug]/_components/thread-menu";
import { useCommunityQuickReply } from "./community-quick-reply";

/**
 * One comment in a thread/comment detail. Twitter-style: the whole row opens the comment's own
 * detail (its replies); like + reply-count + report are interactive children that stop propagation.
 *
 * `rowHref` overrides where the ROW click lands (the profile feed points a reply at its parent post +
 * `?highlight=` so its context opens, not the reply in isolation); the inner reply/send links always
 * stay on this comment. `highlighted` tints the row and scrolls it into view (the `?highlight=` target).
 */
export function CommentRow({
  comment,
  onToggleReaction,
  onToggleBookmark,
  rowHref,
  highlighted,
  zoneId,
  onReplyCountChange,
  onReplyCreated,
}: {
  comment: CommentView;
  onToggleReaction: (
    postId: string,
    nextEmoji: string | null,
    previousEmoji: string | null,
  ) => void;
  onToggleBookmark: (postId: string, adding: boolean) => void;
  rowHref?: ShareHref;
  highlighted?: boolean;
  zoneId?: string;
  onReplyCountChange?: (delta: 1 | -1) => void;
  onReplyCreated?: (comment: CommentView) => void;
}) {
  const t = useTranslations("community");
  const locale = useLocale();
  const router = useRouter();
  const { openQuickReply } = useCommunityQuickReply();
  const href = {
    pathname: "/community/comment/[postId]",
    params: { postId: comment.id },
  } as const;
  const open = () => router.push(rowHref ?? href);
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      open();
    }
  };

  const rowRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (highlighted) rowRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [highlighted]);

  return (
    <div
      ref={rowRef}
      role="link"
      tabIndex={0}
      onClick={open}
      onKeyDown={onKeyDown}
      className="group flex cursor-pointer touch-manipulation items-start gap-3 py-4 pl-3 pr-4 transition-colors hover:bg-black/[0.015] focus-visible:outline-none focus-visible:bg-black/[0.02]"
      // ponytail: persistent tint marks the highlighted reply — no fade timer; add one if it reads as sticky.
      style={highlighted ? { background: "color-mix(in srgb, var(--color-chip) 14%, white)" } : undefined}
    >
      <AuthorLink username={comment.authorUsername}>
        <AuthorAvatar name={comment.authorName} size={36} src={comment.authorAvatarUrl} />
      </AuthorLink>
      <div className="min-w-0 flex-1">
        {/* Single-line header: name + @handle truncate, time never wraps, menu pinned right. */}
        <div className="flex items-center gap-1.5">
          <AuthorLink
            username={comment.authorUsername}
            className="flex-shrink truncate text-[15px] font-semibold hover:underline"
          >
            <span style={{ color: "var(--color-main)" }}>{comment.authorName || t("unknown_author")}</span>
          </AuthorLink>
          {comment.authorUsername && (
            <span className="flex-shrink truncate text-[13px]" style={{ color: "var(--color-secondary)" }}>
              @{comment.authorUsername}
            </span>
          )}
          <span className="flex-shrink-0 whitespace-nowrap text-xs" style={{ color: "var(--color-secondary)" }}>
            · {relativeTime(comment.createdAt, locale)}
          </span>
          <span className="ml-auto flex-shrink-0" onClick={(e) => e.stopPropagation()}>
            <ThreadMenu targetId={comment.id} targetType={ModerationTargetType.POST} />
          </span>
        </div>

        <p className="mt-1 whitespace-pre-wrap break-words text-[15px] leading-[22px]" style={{ color: "var(--color-body)" }}>
          <MentionText text={comment.body} />
        </p>

        <AttachmentGallery attachments={comment.attachments} />

        {/* Action row — reaction palette + reply (opens this comment's detail, where the composer lives) */}
        <div className="-ml-1.5 mt-2 flex flex-wrap items-center gap-2">
          <ReactionBar
            targetType="POST"
            targetId={comment.id}
            reactionCounts={comment.reactionCounts}
            myReactions={comment.myReactions}
            onChange={(nextEmoji, previousEmoji) =>
              onToggleReaction(comment.id, nextEmoji, previousEmoji)
            }
          />

          <button
            type="button"
            aria-label={t("reply")}
            onClick={(e) => {
              e.stopPropagation();
              openQuickReply({
                targetType: "post",
                targetId: comment.id,
                zoneId,
                author: {
                  displayName: comment.authorName,
                  username: comment.authorUsername,
                  avatarUrl: comment.authorAvatarUrl,
                },
                createdAt: comment.createdAt,
                body: comment.body,
                attachments: comment.attachments,
                onPendingChange: onReplyCountChange,
                onCreated: onReplyCreated,
              });
            }}
            className="flex min-h-11 min-w-11 items-center justify-center gap-1 rounded-full px-2 transition-colors hover:bg-black/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
            style={{ color: "var(--color-main)" }}
          >
            <CommentIcon />
            {comment.replyCount > 0 && (
              <span className="text-[13px] tabular-nums">{comment.replyCount}</span>
            )}
          </button>

          <SendButton href={href} />
          <BookmarkButton
            bookmarked={comment.myBookmarked}
            onToggle={(adding) => onToggleBookmark(comment.id, adding)}
          />
        </div>
      </div>
    </div>
  );
}
