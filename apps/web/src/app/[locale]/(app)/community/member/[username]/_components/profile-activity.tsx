"use client";

import { useTranslations } from "next-intl";
import type { AchievementCollectionDto, ForumActivityItem } from "@mentor/types";
import { AchievementCollection } from "@/components/achievements/achievement-collection";
import { PANEL_QUIET_LINK } from "@/components/panel/panel-styles";
import { Link } from "@/i18n/navigation";
import { CommentRow } from "../../../_components/comment-row";
import { CommunityPostCard } from "../../../_components/community-post-card";
import { COMMUNITY_CARD_FLUSH } from "../../../_components/community-row";

export type ProfileTab = "posts" | "achievements";

/**
 * The profile's tabs (Paylaşımlar · Kazanımlar) and what they hold, in one card: posts and replies
 * with their room above each, or the achievement collection.
 */
export function ProfileActivity({
  tab,
  tabs,
  onTab,
  items,
  achievements,
  nextCursor,
  loadingMore,
  onLoadMore,
  onToggleReaction,
  onToggleThreadBookmark,
  onToggleCommentReaction,
  onToggleCommentBookmark,
  onReplyCountChange,
}: {
  tab: ProfileTab;
  tabs: ProfileTab[];
  onTab: (tab: ProfileTab) => void;
  items: ForumActivityItem[];
  achievements: AchievementCollectionDto | null;
  nextCursor: string | null;
  loadingMore: boolean;
  onLoadMore: () => void;
  onToggleReaction: (threadId: string, nextEmoji: string | null, previousEmoji: string | null) => void;
  onToggleThreadBookmark: (threadId: string, adding: boolean) => void;
  onToggleCommentReaction: (postId: string, nextEmoji: string | null, previousEmoji: string | null) => void;
  onToggleCommentBookmark: (postId: string, adding: boolean) => void;
  onReplyCountChange: (type: ForumActivityItem["type"], id: string, delta: 1 | -1) => void;
}) {
  const t = useTranslations("community");

  return (
    <>
      <section className={COMMUNITY_CARD_FLUSH} aria-labelledby={`profile-tab-${tab}`}>
        {/* Achievements are public; saved items have their own page (/community/saved). */}
        <nav className="flex gap-1 border-b border-[var(--color-border)] px-3" aria-label={t("profile_tabs_label")}>
          {tabs.map((entry) => {
            const active = entry === tab;
            return (
              <button
                key={entry}
                id={`profile-tab-${entry}`}
                type="button"
                onClick={() => onTab(entry)}
                aria-current={active ? "page" : undefined}
                className={`relative min-h-12 px-3 text-sm font-extrabold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-focus-ring)] ${active ? "text-[var(--color-main)] after:absolute after:inset-x-2 after:bottom-0 after:h-[3px] after:rounded-full after:bg-[var(--play-cta)]" : "text-[var(--color-secondary)]"}`}
              >
                {entry === "posts" ? t("profile_tab_posts") : t("profile_tab_achievements")}
              </button>
            );
          })}
        </nav>

        {tab === "achievements" ? (
          achievements ? (
            <div className="p-4 sm:p-5">
              <AchievementCollection collection={achievements} />
            </div>
          ) : (
            <p className="px-6 py-10 text-center text-body-sm font-semibold text-[var(--color-secondary)]">{t("error")}</p>
          )
        ) : items.length === 0 ? (
          <p className="px-6 py-10 text-center text-body-sm font-semibold text-[var(--color-secondary)]">
            {t("profile_activity_empty")}
          </p>
        ) : (
          items.map((it) => (
            // Comment rows draw no rule of their own, so every item carries the hairline under it.
            <div
              key={it.type === "thread" ? `t-${it.thread.id}` : `c-${it.comment.id}`}
              className="border-b border-[var(--color-border)] last:border-b-0"
            >
              {it.zone.title ? (
                <Link
                  href={{ pathname: "/community/[slug]", params: { slug: it.zone.slug } }}
                  className="inline-flex min-h-8 items-center px-4 pt-2 text-caption font-bold text-[var(--color-secondary)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] sm:px-5"
                >
                  {it.zone.title}
                </Link>
              ) : null}
              {it.type === "thread" ? (
                <CommunityPostCard
                  thread={it.thread}
                  onToggleReaction={(nextEmoji, previousEmoji) => onToggleReaction(it.thread.id, nextEmoji, previousEmoji)}
                  onToggleBookmark={(adding) => onToggleThreadBookmark(it.thread.id, adding)}
                  onReplyCountChange={(delta) => onReplyCountChange("thread", it.thread.id, delta)}
                  clickable
                />
              ) : (
                // A reply opens its PARENT post with itself highlighted, so its context shows.
                <CommentRow
                  comment={it.comment}
                  onToggleReaction={onToggleCommentReaction}
                  onToggleBookmark={onToggleCommentBookmark}
                  onReplyCountChange={(delta) => onReplyCountChange("comment", it.comment.id, delta)}
                  rowHref={
                    it.comment.parentPostId
                      ? {
                          pathname: "/community/comment/[postId]",
                          params: { postId: it.comment.parentPostId },
                          query: { highlight: it.comment.id },
                        }
                      : {
                          pathname: "/community/message/[threadId]",
                          params: { threadId: it.comment.threadId },
                          query: { highlight: it.comment.id },
                        }
                  }
                />
              )}
            </div>
          ))
        )}
      </section>

      {tab === "posts" && nextCursor ? (
        <button
          type="button"
          disabled={loadingMore}
          onClick={onLoadMore}
          className={`${PANEL_QUIET_LINK} self-center`}
        >
          {t("saved_load_more")}
        </button>
      ) : null}
    </>
  );
}
