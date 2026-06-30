"use client";

import type { ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { ThreadView } from "@mentor/types";
import { relativeTime } from "@/lib/relative-time";
import { AuthorAvatar } from "../../_components/author-avatar";
import { ReactionBar } from "./reaction-bar";

export function ThreadItem({
  thread,
  onToggleReaction,
  actions,
  canModerate,
  onPin,
  onDelete,
}: {
  thread: ThreadView;
  onToggleReaction: (emoji: string, adding: boolean) => void;
  actions?: ReactNode;
  canModerate?: boolean;
  onPin?: (pinned: boolean) => void;
  onDelete?: () => void;
}) {
  const t = useTranslations("topluluk");
  const locale = useLocale();

  return (
    <div
      className="group rounded-xl bg-white px-5 py-4 transition-shadow duration-150 hover:shadow-sm"
      style={{ boxShadow: "0px 1px 4px rgba(37,73,150,0.07)" }}
    >
      <div className="flex items-start gap-3">
        <AuthorAvatar name={thread.authorName} />
        <div className="min-w-0 flex-1">
          {/* Header row */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span
                className="text-sm font-semibold"
                style={{ color: "var(--color-main)", fontFamily: "var(--font-heading)" }}
              >
                {thread.authorName || t("unknown_author")}
              </span>
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
            <div className="flex items-center gap-2">
              <span className="text-xs" style={{ color: "var(--color-secondary)" }}>
                {relativeTime(thread.createdAt, locale)}
              </span>
              {/* Report action — visible on hover */}
              <span className="opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                {actions}
              </span>
            </div>
          </div>

          {/* Body */}
          <p
            className="mt-2 whitespace-pre-wrap text-sm leading-relaxed"
            style={{ color: "var(--color-body)" }}
          >
            {thread.body}
          </p>

          {/* Reactions */}
          <ReactionBar
            counts={thread.reactionCounts}
            mine={thread.myReactions}
            onToggle={onToggleReaction}
          />

          {/* Mod controls */}
          {canModerate && (
            <div
              className="mt-3 flex gap-4 border-t pt-3"
              style={{ borderColor: "rgba(0,0,0,0.06)" }}
            >
              <button
                type="button"
                onClick={() => onPin?.(!thread.isPinned)}
                className="cursor-pointer text-xs transition-colors hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
                style={{ color: "var(--color-secondary)" }}
              >
                {thread.isPinned ? t("unpin") : t("pin")}
              </button>
              <button
                type="button"
                onClick={() => onDelete?.()}
                className="cursor-pointer text-xs transition-colors hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
                style={{ color: "var(--color-danger)" }}
              >
                {t("delete")}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
