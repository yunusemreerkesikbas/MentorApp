"use client";

import { useState, type KeyboardEvent, type MouseEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { ForumFeedItem } from "@mentor/types";
import { PopoverMenu, PopoverMenuItem } from "@/components/popover-menu";
import { Link, useRouter } from "@/i18n/navigation";
import { relativeTime } from "@/lib/relative-time";
import {
  bookmarkThread,
  createReport,
  deleteThread,
  pinThread,
  reactThread,
  setHelpfulVote,
  unreactThread,
  updateForumThread,
} from "@/lib/forum";
import { AuthorAvatar } from "../../_components/author-avatar";
import { BookmarkButton } from "../../_components/bookmark-button";
import { SendButton } from "../../_components/send-button";
import { AttachmentGallery } from "../../_components/attachment-gallery";
import { CommentIcon } from "../../_components/forum-icons";
import { ReactionBar } from "../../_components/reaction-bar";
import { useCommunityQuickReply } from "../../_components/community-quick-reply";

export function DiscoveryFeedCard({
  item,
  onChange,
  compact = false,
}: {
  item: ForumFeedItem;
  onChange?: (item: ForumFeedItem | null) => void;
  compact?: boolean;
}) {
  const t = useTranslations("community");
  const locale = useLocale();
  const router = useRouter();
  const { openQuickReply } = useCommunityQuickReply();
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(item.title ?? "");
  const [body, setBody] = useState(item.body);
  const isQa = item.zone.type === "QA";
  const detailHref = isQa
    ? ({ pathname: "/community/question/[threadId]", params: { threadId: item.id } } as const)
    : ({ pathname: "/community/message/[threadId]", params: { threadId: item.id } } as const);
  const date = relativeTime(item.createdAt, locale);

  const patch = (next: Partial<ForumFeedItem>) => onChange?.({ ...item, ...next });

  const openDetail = () => router.push(detailHref);
  const isInteractiveTarget = (target: EventTarget | null) =>
    target instanceof HTMLElement &&
    Boolean(target.closest("a,button,input,textarea,select,[role='menuitem']"));
  const handleCardClick = (event: MouseEvent<HTMLElement>) => {
    if (!editing && !isInteractiveTarget(event.target)) openDetail();
  };
  const handleCardKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (editing || isInteractiveTarget(event.target)) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openDetail();
    }
  };

  const toggleHelpful = async () => {
    if (busyAction) return;
    const selected = !item.myHelpfulVote;
    patch({
      myHelpfulVote: selected,
      helpfulVoteCount: Math.max(0, item.helpfulVoteCount + (selected ? 1 : -1)),
    });
    setBusyAction("helpful");
    try {
      await setHelpfulVote("THREAD", item.id, selected);
    } catch {
      patch({ myHelpfulVote: item.myHelpfulVote, helpfulVoteCount: item.helpfulVoteCount });
    } finally {
      setBusyAction(null);
    }
  };

  const changeReaction = async (nextEmoji: string | null, previousEmoji: string | null) => {
    if (busyAction) return;
    const nextCounts = { ...item.reactionCounts };
    if (previousEmoji) nextCounts[previousEmoji] = Math.max(0, (nextCounts[previousEmoji] ?? 0) - 1);
    if (nextEmoji) nextCounts[nextEmoji] = (nextCounts[nextEmoji] ?? 0) + 1;
    patch({
      myReactions: nextEmoji ? [nextEmoji] : [],
      reactionCounts: nextCounts,
    });
    setBusyAction("reaction");
    try {
      await (nextEmoji
        ? reactThread(item.id, nextEmoji)
        : previousEmoji
          ? unreactThread(item.id, previousEmoji)
          : Promise.resolve());
    } catch {
      patch({ myReactions: item.myReactions, reactionCounts: item.reactionCounts });
    } finally {
      setBusyAction(null);
    }
  };

  const saveEdit = async () => {
    if (!body.trim() || busyAction) return;
    setBusyAction("edit");
    try {
      await updateForumThread(item.id, {
        body: body.trim(),
        title: title.trim() || null,
        tagIds: item.tags.map((tag) => tag.id),
      });
      patch({
        body: body.trim(),
        title: title.trim() || null,
        editedAt: new Date().toISOString(),
      });
      setEditing(false);
    } finally {
      setBusyAction(null);
    }
  };

  return (
    <article
      role="link"
      tabIndex={0}
      onClick={handleCardClick}
      onKeyDown={handleCardKeyDown}
      className="cursor-pointer border-b border-[#e7e9ee] bg-white px-4 py-3 transition-colors last:border-b-0 hover:bg-black/[0.015] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-focus-ring)] motion-reduce:transition-none sm:px-5"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <AuthorAvatar name={item.author.displayName} src={item.author.avatarUrl} size={40} />
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-1.5 text-sm">
              <span className="truncate font-bold text-[var(--color-main)]">{item.author.displayName}</span>
              <span className="truncate text-[var(--color-secondary)]">@{item.author.username}</span>
            </div>
            <div className="mt-0.5 flex min-w-0 items-center gap-1 text-xs text-[var(--color-secondary)]">
              <Link
                href={{ pathname: "/community/[slug]", params: { slug: item.zone.slug } }}
                className="truncate font-semibold hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
              >
                {item.zone.title}
              </Link>
              <span>·</span>
              <span>{isQa ? t("type_qa") : item.zone.type === "ANNOUNCEMENT" ? t("type_announcement") : t("type_chat")}</span>
            </div>
          </div>
          {item.status === "ANSWERED" && (
            <span className="text-[11px] font-bold text-[#4e8060]">
              {t("answered")}
            </span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <span className="whitespace-nowrap px-1 text-xs text-[var(--color-secondary)]">{date}</span>
          {(item.capabilities.canEdit || item.capabilities.canDelete || item.capabilities.canModerate) && (
            <PopoverMenu
              align="right"
              menuClassName="w-44"
              trigger={({ open, setOpen, menuId }) => (
                <button
                  type="button"
                  aria-label={t("actions")}
                  aria-haspopup="menu"
                  aria-expanded={open}
                  aria-controls={open ? menuId : undefined}
                  onClick={() => setOpen(!open)}
                  className="flex size-8 cursor-pointer items-center justify-center rounded-full text-[var(--color-secondary)] transition-colors hover:bg-black/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] motion-reduce:transition-none"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                    <circle cx="5" cy="12" r="1.6" />
                    <circle cx="12" cy="12" r="1.6" />
                    <circle cx="19" cy="12" r="1.6" />
                  </svg>
                </button>
              )}
            >
              {item.capabilities.canEdit ? (
                <PopoverMenuItem onClick={() => setEditing(true)}>{t("edit")}</PopoverMenuItem>
              ) : null}
              {item.capabilities.canModerate ? (
                <PopoverMenuItem
                  onClick={() => {
                    void pinThread(item.id, !item.isPinned).then(() => patch({ isPinned: !item.isPinned }));
                  }}
                >
                  {item.isPinned ? t("unpin") : t("pin")}
                </PopoverMenuItem>
              ) : null}
              {item.capabilities.canDelete ? (
                <PopoverMenuItem
                  danger
                  onClick={() => {
                    if (window.confirm(t("delete_confirm"))) {
                      void deleteThread(item.id).then(() => onChange?.(null));
                    }
                  }}
                >
                  {t("delete")}
                </PopoverMenuItem>
              ) : (
                <PopoverMenuItem onClick={() => void createReport("THREAD", item.id, "OTHER")}>
                  {t("report")}
                </PopoverMenuItem>
              )}
            </PopoverMenu>
          )}
        </div>
      </div>

      {editing ? (
        <div className="mt-4 grid gap-3">
          <label className="grid gap-1 text-sm font-semibold">
            {t("composer_title")}
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={200}
              className="min-h-11 rounded-xl border px-3 outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
            />
          </label>
          <label className="grid gap-1 text-sm font-semibold">
            {t("composer_content")}
            <textarea
              value={body}
              onChange={(event) => setBody(event.target.value)}
              maxLength={4000}
              rows={5}
              className="rounded-xl border p-3 outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
            />
          </label>
          <div className="flex justify-end gap-2">
            <button type="button" className="min-h-11 rounded-xl border px-4" onClick={() => setEditing(false)}>
              {t("cancel")}
            </button>
            <button
              type="button"
              disabled={busyAction === "edit" || !body.trim()}
              className="min-h-11 rounded-xl px-4 font-bold text-white disabled:opacity-50"
              style={{ background: "var(--color-btn)" }}
              onClick={() => void saveEdit()}
            >
              {t("save")}
            </button>
          </div>
        </div>
      ) : (
        <Link href={detailHref} className="mt-2 block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]">
          {item.title && (
            <h2
              className={compact ? "text-lg font-bold text-[#171a22]" : "text-[22px] font-extrabold leading-[1.2] tracking-[-0.025em] text-[#171a22] sm:text-[24px]"}
            >
              {item.title}
            </h2>
          )}
          <p
            className={`${item.title ? "mt-1" : ""} ${compact ? "line-clamp-2" : "line-clamp-3"} whitespace-pre-line text-[15px] leading-[1.55] ${item.title ? "text-[#69707c]" : "text-[#343945]"}`}
          >
            {item.body}
          </p>
        </Link>
      )}

      {!compact && item.attachments.length > 0 ? (
        <AttachmentGallery attachments={item.attachments} />
      ) : null}

      {item.tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {item.tags.slice(0, 3).map((tag) => (
            <span
              key={tag.id}
              className="rounded-full bg-[#f3f4f6] px-2.5 py-1 text-[11px] font-semibold text-[#666d78]"
            >
              #{tag.name}
            </span>
          ))}
        </div>
      )}

      <div className="mt-1 flex w-full items-center gap-1">
        {isQa ? (
          <div className="flex min-w-11 items-center justify-start">
            <button
              type="button"
              aria-pressed={item.myHelpfulVote}
              disabled={busyAction === "helpful"}
              onClick={() => void toggleHelpful()}
              className="min-h-11 px-2 text-sm font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
              style={{
                color: item.myHelpfulVote ? "#287954" : "#242833",
              }}
            >
              +1 {t("helpful")} · {item.helpfulVoteCount}
            </button>
          </div>
        ) : (
          <ReactionBar
            targetType="THREAD"
            targetId={item.id}
            reactionCounts={item.reactionCounts}
            myReactions={item.myReactions}
            onChange={(nextEmoji, previousEmoji) => void changeReaction(nextEmoji, previousEmoji)}
          />
        )}
        {isQa ? (
          <Link
            href={detailHref}
            aria-label={t("comment_total", { count: item.commentCount })}
            className="community-post-action flex min-h-11 min-w-11 items-center justify-center gap-1 text-sm text-[var(--color-main)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
          >
            <CommentIcon />
            {item.commentCount > 0 ? <span className="text-[13px]">{item.commentCount}</span> : null}
          </Link>
        ) : (
          <button
            type="button"
            aria-label={t("comment_total", { count: item.commentCount })}
            className="community-post-action flex min-h-11 min-w-11 items-center justify-center gap-1 text-sm text-[var(--color-main)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
            onClick={(event) => {
              event.stopPropagation();
              openQuickReply({
                targetType: "thread",
                targetId: item.id,
                zoneId: item.zone.id,
                author: {
                  displayName: item.author.displayName,
                  username: item.author.username,
                  avatarUrl: item.author.avatarUrl,
                },
                createdAt: item.createdAt,
                body: item.body,
                attachments: item.attachments,
                onPendingChange: (delta) =>
                  patch({ commentCount: Math.max(0, item.commentCount + delta) }),
              });
            }}
          >
            <CommentIcon />
            {item.commentCount > 0 ? <span className="text-[13px]">{item.commentCount}</span> : null}
          </button>
        )}
        <SendButton href={detailHref} />
        <BookmarkButton
          bookmarked={item.myBookmarked}
          onToggle={(selected) => {
            patch({ myBookmarked: selected });
            bookmarkThread(item.id, selected).catch(() => patch({ myBookmarked: item.myBookmarked }));
          }}
        />
      </div>
    </article>
  );
}
