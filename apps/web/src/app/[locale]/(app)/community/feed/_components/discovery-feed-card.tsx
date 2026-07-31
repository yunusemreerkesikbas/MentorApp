"use client";

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { ForumFeedItem } from "@mentor/types";
import { Link } from "@/i18n/navigation";
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

const LIKE_EMOJI = "❤️";

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
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(item.title ?? "");
  const [body, setBody] = useState(item.body);
  const isQa = item.zone.type === "QA";
  const detailHref = isQa
    ? ({ pathname: "/community/question/[threadId]", params: { threadId: item.id } } as const)
    : ({ pathname: "/community/message/[threadId]", params: { threadId: item.id } } as const);
  const totalReactions = useMemo(
    () => Object.values(item.reactionCounts).reduce((sum, count) => sum + count, 0),
    [item.reactionCounts],
  );
  const date = new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
  }).format(new Date(item.createdAt));

  const patch = (next: Partial<ForumFeedItem>) => onChange?.({ ...item, ...next });

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

  const toggleLike = async () => {
    if (busyAction) return;
    const selected = !item.myReactions.includes(LIKE_EMOJI);
    const current = item.reactionCounts[LIKE_EMOJI] ?? 0;
    patch({
      myReactions: selected
        ? [...item.myReactions, LIKE_EMOJI]
        : item.myReactions.filter((emoji) => emoji !== LIKE_EMOJI),
      reactionCounts: {
        ...item.reactionCounts,
        [LIKE_EMOJI]: Math.max(0, current + (selected ? 1 : -1)),
      },
    });
    setBusyAction("reaction");
    try {
      await (selected ? reactThread(item.id, LIKE_EMOJI) : unreactThread(item.id, LIKE_EMOJI));
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
      className="rounded-[14px] border border-[#e2e5ea] bg-white p-5 transition-colors hover:border-[var(--community-blue-border)] sm:p-6"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <Link
            href={{ pathname: "/community/[slug]", params: { slug: item.zone.slug } }}
            className="rounded-full px-2.5 py-1 text-[11px] font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
            style={{
              background: isQa ? "#fff0e9" : item.zone.type === "ANNOUNCEMENT" ? "#eaf4ee" : "#f0efff",
              color: isQa ? "#a45636" : item.zone.type === "ANNOUNCEMENT" ? "#49735a" : "#5a5592",
            }}
          >
            {item.zone.title}
          </Link>
          <span className="text-[11px] font-semibold text-[#777d87]">
            {isQa ? t("type_qa") : item.zone.type === "ANNOUNCEMENT" ? t("type_announcement") : t("type_chat")}
          </span>
          {item.status === "ANSWERED" && (
            <span className="text-[11px] font-bold text-[#4e8060]">
              {t("answered")}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <BookmarkButton
            bookmarked={item.myBookmarked}
            onToggle={(selected) => {
              patch({ myBookmarked: selected });
              bookmarkThread(item.id, selected).catch(() => patch({ myBookmarked: item.myBookmarked }));
            }}
          />
          <SendButton href={detailHref} />
          {(item.capabilities.canEdit || item.capabilities.canDelete || item.capabilities.canModerate) && (
            <details className="relative">
              <summary
                className="flex h-8 w-8 cursor-pointer list-none items-center justify-center rounded-full text-lg hover:bg-black/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
                aria-label={t("actions")}
              >
                ···
              </summary>
              <div className="absolute right-0 z-20 mt-1 w-44 rounded-xl border bg-white p-1 shadow-lg">
                {item.capabilities.canEdit && (
                  <button
                    type="button"
                    onClick={() => setEditing(true)}
                    className="min-h-11 w-full rounded-lg px-3 text-left text-sm hover:bg-black/[0.04]"
                  >
                    {t("edit")}
                  </button>
                )}
                {item.capabilities.canModerate && (
                  <button
                    type="button"
                    onClick={() => {
                      void pinThread(item.id, !item.isPinned).then(() => patch({ isPinned: !item.isPinned }));
                    }}
                    className="min-h-11 w-full rounded-lg px-3 text-left text-sm hover:bg-black/[0.04]"
                  >
                    {item.isPinned ? t("unpin") : t("pin")}
                  </button>
                )}
                {item.capabilities.canDelete && (
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm(t("delete_confirm"))) {
                        void deleteThread(item.id).then(() => onChange?.(null));
                      }
                    }}
                    className="min-h-11 w-full rounded-lg px-3 text-left text-sm hover:bg-black/[0.04]"
                    style={{ color: "var(--color-error, #9c2f2f)" }}
                  >
                    {t("delete")}
                  </button>
                )}
                {!item.capabilities.canDelete && (
                  <button
                    type="button"
                    onClick={() => void createReport("THREAD", item.id, "OTHER")}
                    className="min-h-11 w-full rounded-lg px-3 text-left text-sm hover:bg-black/[0.04]"
                  >
                    {t("report")}
                  </button>
                )}
              </div>
            </details>
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
        <Link href={detailHref} className="mt-5 block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]">
          {item.title && (
            <h2
              className={compact ? "text-lg font-bold text-[#171a22]" : "text-[22px] font-extrabold leading-[1.2] tracking-[-0.025em] text-[#171a22] sm:text-[24px]"}
            >
              {item.title}
            </h2>
          )}
          <p
            className={`${item.title ? "mt-2" : ""} ${compact ? "line-clamp-2" : "line-clamp-3"} whitespace-pre-line text-[14px] leading-[1.55] ${item.title ? "text-[#69707c]" : "text-[#343945]"}`}
          >
            {item.body}
          </p>
        </Link>
      )}

      {!compact && item.attachments.length > 0 && (
        <div className="mt-4">
          <AttachmentGallery attachments={item.attachments} />
        </div>
      )}

      {item.tags.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
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

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[#f0f1f4] pt-4">
        <div className="flex min-w-0 items-center gap-2">
          <AuthorAvatar name={item.author.displayName} src={item.author.avatarUrl} size={32} />
          <div className="min-w-0 text-xs">
            <div className="truncate font-bold text-[#282c35]">
              {item.author.displayName}
              <span className="ml-1 font-normal text-[#858a94]">
                @{item.author.username}
              </span>
            </div>
            <div className="mt-0.5 text-[#858a94]">
              {date}
              {item.editedAt ? ` · ${t("edited")}` : ""}
              {item.lastActivityAt !== item.createdAt ? ` · ${t("last_activity")}` : ""}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {isQa ? (
            <button
              type="button"
              aria-pressed={item.myHelpfulVote}
              disabled={busyAction === "helpful"}
              onClick={() => void toggleHelpful()}
              className="min-h-11 rounded-full border border-transparent px-3 text-sm font-bold hover:bg-[#f3f4f6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
              style={{
                background: item.myHelpfulVote ? "#eaf7f0" : "transparent",
                color: item.myHelpfulVote ? "#287954" : "#242833",
              }}
            >
              +1 {t("helpful")} · {item.helpfulVoteCount}
            </button>
          ) : (
            <button
              type="button"
              aria-pressed={item.myReactions.includes(LIKE_EMOJI)}
              disabled={busyAction === "reaction"}
              onClick={() => void toggleLike()}
              className={`min-h-11 rounded-full px-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] ${item.myReactions.includes(LIKE_EMOJI) ? "bg-[#fff0ed] text-[#c94f3d]" : "hover:bg-[#f3f4f6]"}`}
            >
              {LIKE_EMOJI} {totalReactions}
            </button>
          )}
          <Link
            href={detailHref}
            className="flex min-h-11 items-center rounded-full px-3 text-sm font-semibold text-[#555b66] hover:bg-[#f3f4f6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
          >
            {t("comment_total", { count: item.commentCount })}
          </Link>
        </div>
      </div>
    </article>
  );
}
