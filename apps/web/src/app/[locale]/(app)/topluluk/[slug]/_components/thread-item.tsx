"use client";

import type { ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { ThreadView } from "@mentor/types";
import { Card } from "@mentor/ui";
import { ReactionBar } from "./reaction-bar";

/** One feed item (CHAT message / ANNOUNCEMENT). `actions` = report slot; mod controls when `canModerate`. */
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
  const when = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(thread.createdAt),
  );

  return (
    <Card>
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs" style={{ color: "var(--color-secondary)" }}>
          {when}
          {thread.isPinned ? <span> · {t("pinned")}</span> : null}
        </span>
        {actions}
      </div>
      <p className="mt-2 whitespace-pre-wrap text-base" style={{ color: "var(--color-main)" }}>
        {thread.body}
      </p>
      <ReactionBar counts={thread.reactionCounts} mine={thread.myReactions} onToggle={onToggleReaction} />
      {canModerate ? (
        <div className="mt-3 flex gap-3 border-t pt-3 text-xs" style={{ borderColor: "color-mix(in srgb, var(--color-main) 8%, transparent)" }}>
          <button
            type="button"
            onClick={() => onPin?.(!thread.isPinned)}
            className="hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
            style={{ color: "var(--color-secondary)" }}
          >
            {thread.isPinned ? t("unpin") : t("pin")}
          </button>
          <button
            type="button"
            onClick={() => onDelete?.()}
            className="hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
            style={{ color: "var(--color-danger)" }}
          >
            {t("delete")}
          </button>
        </div>
      ) : null}
    </Card>
  );
}
