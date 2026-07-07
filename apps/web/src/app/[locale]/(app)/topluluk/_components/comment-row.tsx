"use client";

import type { KeyboardEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ModerationTargetType, type CommentView } from "@mentor/types";
import { Link, useRouter } from "@/i18n/navigation";
import { relativeTime } from "@/lib/relative-time";
import { AuthorAvatar } from "./author-avatar";
import { AttachmentGallery } from "./attachment-gallery";
import { HeartIcon, CommentIcon } from "./forum-icons";
import { SendButton } from "./send-button";
import { BookmarkButton } from "./bookmark-button";
import { ThreadMenu } from "../[slug]/_components/thread-menu";

/**
 * One comment in a thread/comment detail. Twitter-style: the whole row opens the comment's own
 * detail (its replies); like + reply-count + report are interactive children that stop propagation.
 */
export function CommentRow({
  comment,
  onToggleLike,
  onToggleBookmark,
}: {
  comment: CommentView;
  onToggleLike: (postId: string, adding: boolean) => void;
  onToggleBookmark: (postId: string, adding: boolean) => void;
}) {
  const t = useTranslations("topluluk");
  const locale = useLocale();
  const router = useRouter();
  const href = `/topluluk/yorum/${comment.id}`;
  const open = () => router.push(href);
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      open();
    }
  };

  return (
    <div
      role="link"
      tabIndex={0}
      onClick={open}
      onKeyDown={onKeyDown}
      className="group flex cursor-pointer touch-manipulation items-start gap-3 py-4 pl-3 pr-4 transition-colors hover:bg-black/[0.015] focus-visible:outline-none focus-visible:bg-black/[0.02]"
    >
      <AuthorAvatar name={comment.authorName} size={36} src={comment.authorAvatarUrl} />
      <div className="min-w-0 flex-1">
        {/* Single-line header: name + @handle truncate, time never wraps, menu pinned right. */}
        <div className="flex items-center gap-1.5">
          <span className="flex-shrink truncate text-[15px] font-semibold" style={{ color: "var(--color-main)" }}>
            {comment.authorName || t("unknown_author")}
          </span>
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
          {comment.body}
        </p>

        <AttachmentGallery attachments={comment.attachments} />

        {/* Action row — like + reply (opens this comment's detail, where the composer lives) */}
        <div className="-ml-1.5 mt-2 flex items-center gap-3">
          <button
            type="button"
            aria-pressed={comment.myLiked}
            aria-label={t("like")}
            onClick={(e) => {
              e.stopPropagation();
              onToggleLike(comment.id, !comment.myLiked);
            }}
            className="group/like flex h-8 items-center gap-1 rounded-full px-1.5 transition-colors hover:bg-black/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
            style={{ color: comment.myLiked ? "var(--color-danger)" : "var(--color-main)" }}
          >
            <span
              key={comment.myLiked ? "on" : "off"}
              className={`inline-flex transition-transform duration-150 group-hover/like:scale-110 motion-reduce:transition-none ${comment.myLiked ? "forum-like-pop" : ""}`}
            >
              <HeartIcon filled={comment.myLiked} />
            </span>
            {comment.likeCount > 0 && (
              <span className="text-[13px] tabular-nums">{comment.likeCount}</span>
            )}
          </button>

          <Link
            href={href}
            aria-label={t("reply")}
            onClick={(e) => e.stopPropagation()}
            className="flex h-8 items-center gap-1 rounded-full px-1.5 transition-colors hover:bg-black/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
            style={{ color: "var(--color-main)" }}
          >
            <CommentIcon />
            {comment.replyCount > 0 && (
              <span className="text-[13px] tabular-nums">{comment.replyCount}</span>
            )}
          </Link>

          <SendButton path={href} />
          <BookmarkButton
            bookmarked={comment.myBookmarked}
            onToggle={(adding) => onToggleBookmark(comment.id, adding)}
          />
        </div>
      </div>
    </div>
  );
}
