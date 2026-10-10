"use client";

import { useState, type KeyboardEvent } from "react";
import { Pin } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import type { CommentView, ThreadView } from "@mentor/types";
import { Button } from "@mentor/ui";
import { PANEL_QUIET_LINK } from "@/components/panel/panel-styles";
import { useRouter } from "@/i18n/navigation";
import { relativeTime } from "@/lib/relative-time";
import { deleteThread, updateForumThread } from "@/lib/forum";
import { AuthorAvatar } from "../../_components/author-avatar";
import { AuthorLink } from "../../_components/author-link";
import { AttachmentGallery } from "../../_components/attachment-gallery";
import { CommentIcon } from "../../_components/forum-icons";
import { MentionText } from "../../_components/mention-text";
import { ReactionBar } from "../../_components/reaction-bar";
import { SendButton } from "../../_components/send-button";
import { BookmarkButton } from "../../_components/bookmark-button";
import { ComposerBodyField } from "../../_components/composer-body-field";
import { useCommunityQuickReply } from "../../_components/community-quick-reply";
import { ForumPollCard } from "../../_components/forum-poll-card";
import { COMMUNITY_FIELD } from "../../_components/community-row";
import { useConfirmDelete } from "../../_components/use-confirm-delete";
import { ThreadMenu } from "./thread-menu";

export function ThreadItem({
  thread,
  onToggleReaction,
  onToggleBookmark,
  canModerate,
  onPin,
  onDelete,
  afterDelete,
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
  /** Where the detail page goes once its own post is gone (a direct link has no history to go back to). */
  afterDelete?: () => void;
  /** Feed rows open the post detail on click (Twitter-style); the detail page's own thread doesn't. */
  clickable?: boolean;
  onReplyCountChange?: (delta: 1 | -1) => void;
  onReplyCreated?: (comment: CommentView) => void;
}) {
  const t = useTranslations("community");
  const locale = useLocale();
  const router = useRouter();
  const { openQuickReply } = useCommunityQuickReply();
  const confirmDelete = useConfirmDelete();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [content, setContent] = useState<{ title: string | null; body: string } | null>(null);
  const [draftTitle, setDraftTitle] = useState(thread.title ?? "");
  const [draftBody, setDraftBody] = useState(thread.body);
  const [poll, setPoll] = useState(thread.poll);
  const displayedTitle = content ? content.title : thread.title;
  const displayedBody = content ? content.body : thread.body;
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
  const beginEdit = () => {
    setDraftTitle(displayedTitle ?? "");
    setDraftBody(displayedBody);
    setEditError(null);
    setEditing(true);
  };
  const saveEdit = async () => {
    const body = draftBody.trim();
    if (!body || busy) return;
    setBusy(true);
    setEditError(null);
    try {
      const title = thread.title === null ? null : draftTitle.trim() || null;
      await updateForumThread(thread.id, { body, ...(thread.title !== null ? { title } : {}) });
      setContent({ title, body });
      setEditing(false);
    } catch (error) {
      setEditError(error instanceof Error ? error.message : t("action_failed"));
    } finally {
      setBusy(false);
    }
  };
  const removeThread = async () => {
    if (!(await confirmDelete())) return;
    if (onDelete) {
      onDelete();
      return;
    }
    try {
      await deleteThread(thread.id);
      setDeleted(true);
      afterDelete?.();
    } catch (error) {
      setEditError(error instanceof Error ? error.message : t("action_failed"));
    }
  };
  const rowProps = clickable && !editing
    ? {
        role: "link" as const,
        tabIndex: 0,
        onClick: open,
        onKeyDown: onRowKeyDown,
        className:
          "flex cursor-pointer touch-manipulation items-start gap-3 border-b border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 transition-colors last:border-b-0 hover:bg-[color-mix(in_srgb,var(--color-main)_3%,transparent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-focus-ring)] motion-reduce:transition-none sm:px-5",
      }
    : { className: "flex items-start gap-3 border-b border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 last:border-b-0 sm:px-5" };

  if (deleted) return null;

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
              className="flex-shrink truncate text-body-sm font-extrabold text-[var(--color-main)] hover:underline"
            >
              {thread.authorName || t("unknown_author")}
            </AuthorLink>
            {thread.authorUsername && (
              <span className="flex-shrink truncate text-caption font-semibold text-[var(--color-secondary)]">
                @{thread.authorUsername}
              </span>
            )}
            {/* Pinned is said in words beside the name, not as a chip. */}
            {thread.isPinned && (
              <span className="inline-flex shrink-0 items-center gap-1 text-xs font-extrabold text-[var(--color-secondary)]">
                <Pin size={13} strokeWidth={2} aria-hidden />
                {t("pinned")}
              </span>
            )}
          </div>
          <div className="flex flex-shrink-0 items-center gap-2">
            <span className="whitespace-nowrap text-caption font-semibold text-[var(--color-secondary)]">
              {relativeTime(thread.createdAt, locale)}
            </span>
            {/* Menu owns its own clicks — don't let them trigger the row navigation. */}
            <span onClick={(e) => e.stopPropagation()}>
              <ThreadMenu
                targetId={thread.id}
                isPinned={thread.isPinned}
                canEdit={thread.capabilities?.canEdit}
                canDelete={thread.capabilities?.canDelete}
                canModerate={thread.capabilities?.canModerate ?? canModerate}
                onEdit={beginEdit}
                onPin={onPin}
                onDelete={() => void removeThread()}
              />
            </span>
          </div>
        </div>

        {editing ? (
          <div className="mt-3 grid gap-3" onClick={(event) => event.stopPropagation()}>
            {thread.title !== null ? (
              <label className="grid gap-1.5 text-caption font-bold text-[var(--color-secondary)]">
                {t("composer_title")}
                <input
                  value={draftTitle}
                  onChange={(event) => setDraftTitle(event.target.value)}
                  maxLength={200}
                  disabled={busy}
                  className={COMMUNITY_FIELD}
                />
              </label>
            ) : null}
            <ComposerBodyField
              id={`thread-edit-body-${thread.id}`}
              label={t("composer_content")}
              value={draftBody}
              onValueChange={setDraftBody}
              disabled={busy}
              rows={5}
              autoFocus
              hideLabel
              onSubmit={() => void saveEdit()}
            />
            {editError ? (
              <p role="alert" className="text-caption font-semibold text-[var(--color-danger)]">
                {editError}
              </p>
            ) : null}
            <div className="flex items-center justify-end gap-[18px] pt-2">
              <button type="button" disabled={busy} className={PANEL_QUIET_LINK} onClick={() => setEditing(false)}>
                {t("cancel")}
              </button>
              <Button size="sm" disabled={busy || !draftBody.trim()} onClick={() => void saveEdit()}>
                {t("save")}
              </Button>
            </div>
          </div>
        ) : displayedTitle ? (
          <h2 className="mt-2 text-lg font-extrabold leading-snug text-[var(--color-main)]">
            {displayedTitle}
          </h2>
        ) : null}
        {!editing ? (
          <p
            className={`${displayedTitle ? "text-[var(--color-secondary)]" : "text-[var(--color-body)]"} whitespace-pre-wrap break-words text-body-sm font-semibold`}
          >
            <MentionText text={displayedBody} />
          </p>
        ) : null}

        {!editing && editError ? (
          <p role="alert" className="mt-2 text-caption font-semibold text-[var(--color-danger)]">
            {editError}
          </p>
        ) : null}

        {!editing && poll ? <ForumPollCard poll={poll} onChange={setPoll} /> : null}

        {!editing && thread.attachments.length > 0 ? (
          <AttachmentGallery attachments={thread.attachments} />
        ) : null}

        {/* Action row — reaction palette + comment count · send (share link) · bookmark. */}
        <div className="mt-1 flex w-full flex-wrap items-center gap-1">
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
                body: displayedBody,
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
              <span className="text-caption font-extrabold">{thread.commentCount}</span>
            ) : null}
          </button>

          <SendButton href={detailHref} />
          <BookmarkButton bookmarked={thread.myBookmarked} onToggle={onToggleBookmark} />
        </div>

      </div>
    </div>
  );
}
