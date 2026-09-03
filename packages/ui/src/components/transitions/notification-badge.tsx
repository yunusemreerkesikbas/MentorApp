"use client";

import type * as React from "react";

export interface NotificationBadgeProps {
  /** When true, badge slides/pops in; when false, scales out. */
  open: boolean;
  /** Count or label inside the dot. Omit for empty dot. */
  count?: React.ReactNode;
  className?: string;
}

/**
 * Notification badge — place inside a `position: relative` trigger.
 * Only the badge animates; the trigger stays put.
 */
export function NotificationBadge({ open, count, className }: NotificationBadgeProps) {
  return (
    <span
      className={`t-badge absolute -right-2 -top-1.5 pointer-events-none${className ? ` ${className}` : ""}`}
      data-open={open ? "true" : "false"}
      aria-hidden
    >
      <span className="t-badge-dot flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] font-bold leading-none text-white"
        style={{
          background: "var(--color-progress)",
          fontFamily: "var(--font-body)",
        }}
      >
        {count}
      </span>
    </span>
  );
}
