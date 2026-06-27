"use client";

import type { ReactNode } from "react";
import type { NotificationCategory, UserNotificationDto } from "@mentor/types";

export interface NotificationDrawerItemProps {
  notification: UserNotificationDto;
  onMarkRead: (id: string) => void;
  renderIcon?: (category: NotificationCategory) => ReactNode;
  labels: Pick<import("./types.js").NotificationDrawerLabels, "timeJustNow" | "timeHoursAgo" | "timeYesterday" | "timeDaysAgo">;
}

function relativeTime(
  iso: string,
  labels: NotificationDrawerItemProps["labels"],
): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffH = Math.floor(diffMs / 3_600_000);
  if (diffH < 1) return labels.timeJustNow;
  if (diffH < 24) return labels.timeHoursAgo(diffH);
  const diffD = Math.floor(diffH / 24);
  if (diffD === 1) return labels.timeYesterday;
  return labels.timeDaysAgo(diffD);
}

export function NotificationDrawerItem({
  notification,
  onMarkRead,
  renderIcon,
  labels,
}: NotificationDrawerItemProps) {
  const isUnread = notification.readAt === null;

  function handleClick() {
    if (isUnread) onMarkRead(notification.id);
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleClick();
        }
      }}
      aria-label={notification.title}
      className="relative flex cursor-pointer gap-3 border-b px-4 py-3 transition-colors focus-visible:outline-none"
      style={{
        backgroundColor: isUnread ? "#ffffff" : "transparent",
        borderColor: "var(--color-surface-high, #ebe7e7)",
      }}
      // hover via inline style not possible — use Tailwind group
    >
      {/* Unread dot */}
      {isUnread && (
        <span
          aria-hidden
          className="absolute left-3 top-4 h-2 w-2 shrink-0 rounded-full"
          style={{ backgroundColor: "var(--color-progress)" }}
        />
      )}

      {/* Category icon */}
      <div
        className="ml-3 mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white"
        style={{
          backgroundColor: isUnread
            ? "color-mix(in srgb, var(--color-chip) 30%, transparent)"
            : "color-mix(in srgb, var(--color-main) 8%, transparent)",
        }}
      >
        {renderIcon ? (
          renderIcon(notification.category)
        ) : (
          <span
            className="material-symbols-outlined text-[20px]"
            style={{
              color: isUnread ? "var(--color-chip-text)" : "var(--color-secondary)",
            }}
          >
            notifications
          </span>
        )}
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1 pt-0.5">
        <div className="mb-0.5 flex items-start justify-between gap-2">
          <p
            className="truncate text-sm leading-snug"
            style={{
              fontFamily: "var(--font-body)",
              fontWeight: isUnread ? 700 : 400,
              color: isUnread ? "var(--color-main)" : "var(--color-secondary)",
            }}
          >
            {notification.title}
          </p>
          <span
            className="shrink-0 text-[11px] leading-none"
            style={{
              fontFamily: "var(--font-body)",
              color: "var(--color-secondary)",
            }}
          >
            {relativeTime(notification.createdAt, labels)}
          </span>
        </div>
        <p
          className="line-clamp-2 text-sm leading-snug"
          style={{
            fontFamily: "var(--font-body)",
            color: "var(--color-secondary)",
          }}
        >
          {notification.body}
        </p>
      </div>
    </div>
  );
}
