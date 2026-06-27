"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import type { NotificationCategory, NotificationListDto, UserNotificationDto } from "@mentor/types";
import { NotificationDrawerProvider } from "@mentor/ui";
import { PuhuImage } from "@/components/puhu-image";
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "./notification-api";

const ICON_BY_CATEGORY: Record<NotificationCategory, string> = {
  COACH: "psychology",
  PLAN: "checklist",
  CONTENT: "article",
};

const ICON_COLOR_BY_CATEGORY: Record<NotificationCategory, string> = {
  COACH: "var(--color-chip-text)",
  PLAN: "#4A80D8",
  CONTENT: "var(--color-secondary)",
};

function CategoryIcon({ category }: { category: NotificationCategory }) {
  return (
    <span
      className="material-symbols-outlined text-[20px]"
      aria-hidden
      style={{ color: ICON_COLOR_BY_CATEGORY[category] }}
    >
      {ICON_BY_CATEGORY[category]}
    </span>
  );
}

const EMPTY: NotificationListDto = { items: [], unreadCount: 0, hasMore: false };

interface NotificationDrawerShellProps {
  children: ReactNode;
}

/** Web-layer wrapper: fetches data, injects i18n labels and Puhu icons. */
export function NotificationDrawerShell({ children }: NotificationDrawerShellProps) {
  const t = useTranslations("notifications");
  const [data, setData] = useState<NotificationListDto>(EMPTY);

  useEffect(() => {
    listNotifications().then(setData).catch(() => {/* non-blocking — drawer shows empty */});
  }, []);

  async function handleMarkRead(id: string): Promise<void> {
    await markNotificationRead(id);
    setData((prev) => ({
      ...prev,
      unreadCount: Math.max(0, prev.unreadCount - 1),
    }));
  }

  async function handleMarkAllRead(): Promise<void> {
    await markAllNotificationsRead();
    setData((prev) => ({
      ...prev,
      items: prev.items.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })),
      unreadCount: 0,
    }));
  }

  const emptyState = (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      <PuhuImage variant="default" size={64} className="mb-3 opacity-80 drop-shadow-sm" />
      <p
        className="mb-1 text-base font-bold"
        style={{ fontFamily: "var(--font-heading)", color: "var(--color-main)" }}
      >
        {t("empty_title")}
      </p>
      <p
        className="text-sm"
        style={{ fontFamily: "var(--font-body)", color: "var(--color-secondary)" }}
      >
        {t("empty_body")}
      </p>
    </div>
  );

  return (
    <NotificationDrawerProvider
      items={data.items}
      unreadCount={data.unreadCount}
      onMarkRead={handleMarkRead}
      onMarkAllRead={handleMarkAllRead}
      renderIcon={(category: NotificationCategory) => <CategoryIcon category={category} />}
      emptyState={emptyState}
      labels={{
        title: t("title"),
        markAllRead: t("mark_all_read"),
        close: t("close"),
        tabAll: t("tab_all"),
        tabCoach: t("tab_coach"),
        tabPlan: t("tab_plan"),
        emptyTitle: t("empty_title"),
        emptyBody: t("empty_body"),
        timeJustNow: t("time_just_now"),
        timeHoursAgo: (count) => t("time_hours_ago", { count }),
        timeYesterday: t("time_yesterday"),
        timeDaysAgo: (count) => t("time_days_ago", { count }),
        unreadLabel: t("unread_label"),
      }}
    >
      {children}
    </NotificationDrawerProvider>
  );
}
