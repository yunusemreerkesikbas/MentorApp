"use client";

import type { KeyboardEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import { FORUM_LIKE_EMOJI, type ThreadView } from "@mentor/types";
import { Link, useRouter } from "@/i18n/navigation";
import { relativeTime } from "@/lib/relative-time";
import { AuthorAvatar } from "../../_components/author-avatar";
import { AuthorLink } from "../../_components/author-link";
import { AttachmentGallery } from "../../_components/attachment-gallery";
import { CommentIcon, HeartIcon } from "../../_components/forum-icons";
import { MentionText } from "../../_components/mention-text";
import { SendButton } from "../../_components/send-button";
import { BookmarkButton } from "../../_components/bookmark-button";
import { ThreadMenu } from "./thread-menu";

export function ThreadItem({
  thread,
  onToggleReaction,
  onToggleBookmark,
  canModerate,
  onPin,
  onDelete,
  clickable = false,
}: {
  thread: ThreadView;
  onToggleReaction: (emoji: string, adding: boolean) => void;
  onToggleBookmark: (adding: boolean) => void;
  canModerate?: boolean;
  onPin?: (pinned: boolean) => void;
  onDelete?: () => void;
  /** Feed rows open the post detail on click (Twitter-style); the detail page's own thread doesn't. */
  clickable?: boolean;
}) {
  const t = useTranslations("topluluk");
  const locale = useLocale();
  const router = useRouter();
  const liked = thread.myReactions.includes(FORUM_LIKE_EMOJI);
  const likeCount = thread.reactionCounts[FORUM_LIKE_EMOJI] ?? 0;
  const detailHref = `/topluluk/mesaj/${thread.id}`;
  const repliers = thread.commenterNames.slice(0, 3);

  // Summary order mirrors Figma "7 respostas · 59 curtidas" — comments first, then likes.
  const summary: string[] = [];
  if (thread.commentCount > 0) summary.push(t("comment_total", { count: thread.commentCount }));
  if (likeCount > 0) summary.push(t("like_total", { count: likeCount }));

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

        {/* Action row — bare icons (Figma 1:300: 24px frames, no inline counts). Counts live only in
            the summary line below. Like · comment · send (share link) · bookmark. */}
        <div className="-ml-1.5 mt-2 flex items-center gap-1.5">
          <button
            type="button"
            aria-pressed={liked}
            aria-label={t("like")}
            onClick={(e) => {
              e.stopPropagation();
              onToggleReaction(FORUM_LIKE_EMOJI, !liked);
            }}
            className="group/like flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-black/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
            style={{ color: liked ? "var(--color-danger)" : "var(--color-main)" }}
          >
            {/* Remount on toggle so the one-shot pop replays each time a post is liked. */}
            <span
              key={liked ? "on" : "off"}
              className={`inline-flex transition-transform duration-150 group-hover/like:scale-110 group-active/like:scale-90 motion-reduce:transition-none ${liked ? "forum-like-pop" : ""}`}
            >
              <HeartIcon filled={liked} />
            </span>
          </button>

          <Link
            href={detailHref}
            aria-label={t("comment")}
            onClick={(e) => e.stopPropagation()}
            className="group/cmt flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-black/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
            style={{ color: "var(--color-main)" }}
          >
            <span className="inline-flex transition-transform duration-150 group-hover/cmt:scale-110 motion-reduce:transition-none">
              <CommentIcon />
            </span>
          </Link>

          <SendButton path={detailHref} />
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
