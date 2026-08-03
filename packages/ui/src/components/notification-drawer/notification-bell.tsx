"use client";
import { Bell } from "lucide-react";

import { useNotificationDrawer } from "./notification-drawer-context.js";

export interface NotificationBellProps {
  /** Screen-reader label for the bell button. */
  label?: string;
  /** Word appended after unread count in the aria-label. e.g. "okunmamış" / "unread" */
  unreadLabel?: string;
}

/**
 * Bell trigger button — place inside a `relative`-positioned container so the
 * desktop popover anchors correctly. Reads state from NotificationDrawerProvider.
 */
export function NotificationBell({
  label = "Notifications",
  unreadLabel = "unread",
}: NotificationBellProps) {
  const { toggle, unreadCount } = useNotificationDrawer();

  return (
    <button
      type="button"
      aria-label={
        unreadCount > 0 ? `${label} (${unreadCount} ${unreadLabel})` : label
      }
      aria-haspopup="dialog"
      onClick={toggle}
      className="relative flex h-11 w-11 items-center justify-center rounded-full transition-colors hover:bg-black/8 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] focus-visible:ring-offset-2 active:scale-95"
    >
      <Bell size={24} color="var(--color-main)" strokeWidth={2} aria-hidden />

      {unreadCount > 0 && (
        <span
          aria-hidden
          className="absolute right-1.5 top-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] font-bold text-white"
          style={{
            backgroundColor: "var(--color-progress)",
            fontFamily: "var(--font-body)",
          }}
        >
          {unreadCount > 99 ? "99+" : unreadCount}
        </span>
      )}
    </button>
  );
}
