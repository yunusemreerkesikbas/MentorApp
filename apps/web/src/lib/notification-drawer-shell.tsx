"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Brain from "lucide-react/dist/esm/icons/brain.mjs";
import FileText from "lucide-react/dist/esm/icons/file-text.mjs";
import ListCheck from "lucide-react/dist/esm/icons/list-check.mjs";
import MessageCircle from "lucide-react/dist/esm/icons/message-circle.mjs";
import { useTranslations } from "next-intl";
import type { NotificationCategory, NotificationListDto, UserNotificationDto } from "@mentor/types";
import { NotificationDrawerProvider, useDialog } from "@mentor/ui";
import { PuhuImage } from "@/components/puhu-image";
import { useRouter } from "@/i18n/navigation";
import {
  deleteNotification,
  getNotificationStreamToken,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  markNotificationUnread,
} from "./notification-api";
import { apiBaseUrl } from "./api-base";

const ICON_BY_CATEGORY = {
  COACH: Brain,
  PLAN: ListCheck,
  CONTENT: FileText,
  FORUM: MessageCircle,
};

const ICON_COLOR_BY_CATEGORY: Record<NotificationCategory, string> = {
  COACH: "var(--color-chip-text)",
  PLAN: "#4A80D8",
  CONTENT: "var(--color-secondary)",
  FORUM: "var(--color-progress)",
};

function CategoryIcon({ category }: { category: NotificationCategory }) {
  const Icon = ICON_BY_CATEGORY[category];

  return (
    <Icon size={20} color={ICON_COLOR_BY_CATEGORY[category]} strokeWidth={2} aria-hidden />
  );
}

const EMPTY: NotificationListDto = { items: [], unreadCount: 0, hasMore: false };

interface NotificationDrawerShellProps {
  children: ReactNode;
}

const CATEGORY_FALLBACK: Record<NotificationCategory, string> = {
  COACH: "/dashboard",
  PLAN: "/plan",
  CONTENT: "/knowledge",
  FORUM: "/community",
};

/** Web-layer wrapper: fetches data, injects i18n labels and Puhu icons. */
export function NotificationDrawerShell({ children }: NotificationDrawerShellProps) {
  const t = useTranslations("notifications");
  const tSession = useTranslations("session");
  const router = useRouter();
  const dialog = useDialog();
  const [data, setData] = useState<NotificationListDto>(EMPTY);

  useEffect(() => {
    listNotifications().then(setData).catch(() => {/* non-blocking — drawer shows empty */});
  }, []);

  // Live "study together" invite → attention-grabbing modal. Kept in a ref so the SSE
  // connection (below) never reconnects when dialog/router/locale change. Fires only on a
  // real-time push — never on history load — so a stale invite can't pop hours later.
  const showStudyInviteRef = useRef<(actorName: string) => void>(() => {});
  useEffect(() => {
    showStudyInviteRef.current = (actorName: string) => {
      void dialog
        .promo({
          title: tSession("buddy_invite_modal_title", { name: actorName }),
          message: tSession("buddy_invite_modal_body"),
          primaryLabel: tSession("buddy_invite_modal_start"),
          linkLabel: tSession("buddy_invite_modal_later"),
          closeLabel: t("close"),
        })
        .then((result) => {
          if (result === "primary") router.push("/study-session");
        });
    };
  });

  // SSE: real-time bell updates — connect once on mount, reconnect on visibility
  useEffect(() => {
    const apiBase = apiBaseUrl();
    let es: EventSource | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;

    async function connect() {
      if (cancelled) return;
      try {
        const token = await getNotificationStreamToken();
        if (cancelled) return; // cleanup ran while awaiting token
        es = new EventSource(`${apiBase}/v1/notifications/stream?token=${token}`);
        es.onmessage = (ev: MessageEvent) => {
          // Branch on the typed payload: a live study-invite opens a modal (in addition
          // to the drawer refresh); every event still refreshes the bell.
          let payload: { event?: string; actorName?: string } | null = null;
          try {
            payload = JSON.parse(ev.data as string);
          } catch {
            payload = null; // heartbeat sends an empty frame — nothing to do
          }
          if (!payload?.event) return;
          if (payload.event === "study_invite" && payload.actorName) {
            showStudyInviteRef.current(payload.actorName);
          }
          listNotifications().then(setData).catch(() => {});
        };
        es.onerror = () => {
          es?.close();
          es = null;
          if (!cancelled) reconnectTimer = setTimeout(connect, 5_000);
        };
      } catch {
        if (!cancelled) reconnectTimer = setTimeout(connect, 5_000);
      }
    }

    function handleVisibility() {
      if (document.visibilityState === "visible") {
        listNotifications().then(setData).catch(() => {});
        if (!es || es.readyState === EventSource.CLOSED) connect();
      }
    }

    connect();
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      cancelled = true;
      es?.close();
      if (reconnectTimer) clearTimeout(reconnectTimer);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
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

  async function handleMarkUnread(id: string): Promise<void> {
    await markNotificationUnread(id);
    setData((prev) => ({
      ...prev,
      unreadCount: prev.unreadCount + 1,
    }));
  }

  async function handleDelete(id: string): Promise<void> {
    await deleteNotification(id);
    setData((prev) => {
      const removed = prev.items.find((n) => n.id === id);
      return {
        ...prev,
        items: prev.items.filter((n) => n.id !== id),
        unreadCount: removed?.readAt === null ? Math.max(0, prev.unreadCount - 1) : prev.unreadCount,
      };
    });
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

  function handleNotificationClick(notification: UserNotificationDto) {
    const href = notification.linkUrl ?? CATEGORY_FALLBACK[notification.category];
    // Notification targets are canonical internal paths produced by the API.
    // @ts-expect-error -- the DTO intentionally transports the path as a string.
    router.push(href);
  }

  return (
    <NotificationDrawerProvider
      items={data.items}
      unreadCount={data.unreadCount}
      onMarkRead={handleMarkRead}
      onMarkUnread={handleMarkUnread}
      onMarkAllRead={handleMarkAllRead}
      onDelete={handleDelete}
      onNotificationClick={handleNotificationClick}
      renderIcon={(category: NotificationCategory) => <CategoryIcon category={category} />}
      emptyState={emptyState}
      labels={{
        title: t("title"),
        markAllRead: t("mark_all_read"),
        markRead: t("mark_read"),
        markUnread: t("mark_unread"),
        deleteItem: t("delete_item"),
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
