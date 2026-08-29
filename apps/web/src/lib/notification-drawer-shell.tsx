"use client";
import { Award, Brain, FileText, ListCheck, Megaphone, MessageCircle } from "lucide-react";
import { AnimatePresence } from "framer-motion";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import type {
  AchievementCelebrationDto,
  JourneyLevelCelebrationView,
  NotificationCategory,
  NotificationListDto,
  UserNotificationDto,
} from "@mentor/types";
import { NotificationDrawerProvider } from "@mentor/ui";
import { PuhuImage } from "@/components/puhu-image";
import { AchievementCelebration } from "@/components/achievements/achievement-celebration";
import { JourneySpotlightScene } from "@/components/journey-levels/spotlight/journey-spotlight-scene";
import {
  getUnseenAchievements,
  getUnseenJourneyLevelCelebrations,
  markAchievementsCelebrated,
  markJourneyLevelCelebrated,
} from "@/lib/community";
import { buildCelebrationQueue } from "@/lib/celebration-queue";
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
  ACHIEVEMENT: Award,
  SYSTEM: Megaphone,
};

/**
 * The glyph is the primary category carrier (never colour alone — WCAG 1.4.1); colour only adds
 * emphasis. Tokens only: `--color-accent` is an alias of `--color-progress`, so ACHIEVEMENT and
 * FORUM used to render in the identical blue, and PLAN carried a hard-coded hex.
 */
const ICON_COLOR_BY_CATEGORY: Record<NotificationCategory, string> = {
  COACH: "var(--color-chip-text)",
  PLAN: "var(--color-progress)",
  CONTENT: "var(--color-secondary)",
  FORUM: "var(--color-progress)",
  ACHIEVEMENT: "var(--color-star)",
  SYSTEM: "var(--color-main)",
};

function CategoryIcon({ category }: { category: NotificationCategory }) {
  const Icon = ICON_BY_CATEGORY[category];

  return (
    <Icon size={18} color={ICON_COLOR_BY_CATEGORY[category]} strokeWidth={2} aria-hidden />
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
  ACHIEVEMENT: "/community",
  SYSTEM: "/dashboard",
};

/** Web-layer wrapper: fetches data, injects i18n labels and Puhu icons. */
export function NotificationDrawerShell({ children }: NotificationDrawerShellProps) {
  const t = useTranslations("notifications");
  const tJourney = useTranslations("journey_levels");
  const router = useRouter();
  const [data, setData] = useState<NotificationListDto>(EMPTY);
  const [achievementCelebrations, setAchievementCelebrations] = useState<AchievementCelebrationDto[]>([]);
  const [journeyLevelCelebrations, setJourneyLevelCelebrations] = useState<JourneyLevelCelebrationView[]>([]);
  const [celebrationBusy, setCelebrationBusy] = useState(false);
  const [journeyCelebrationError, setJourneyCelebrationError] = useState<string | null>(null);

  const refreshCelebrations = useCallback(async () => {
    const [achievementsResult, journeyResult] = await Promise.allSettled([
      getUnseenAchievements(),
      getUnseenJourneyLevelCelebrations(),
    ]);
    if (achievementsResult.status === "fulfilled") {
      setAchievementCelebrations(achievementsResult.value.celebrations);
    }
    if (journeyResult.status === "fulfilled") {
      setJourneyLevelCelebrations(journeyResult.value.celebrations);
    }
  }, []);

  const celebrationQueue = useMemo(
    () => buildCelebrationQueue(achievementCelebrations, journeyLevelCelebrations),
    [achievementCelebrations, journeyLevelCelebrations],
  );
  const currentCelebration = celebrationQueue[0];

  useEffect(() => {
    void Promise.allSettled([
      listNotifications(),
      getUnseenAchievements(),
      getUnseenJourneyLevelCelebrations(),
    ]).then(([notificationsResult, achievementsResult, journeyResult]) => {
      if (notificationsResult.status === "fulfilled") {
        setData(notificationsResult.value);
      }
      if (achievementsResult.status === "fulfilled") {
        setAchievementCelebrations(achievementsResult.value.celebrations);
      }
      if (journeyResult.status === "fulfilled") {
        setJourneyLevelCelebrations(journeyResult.value.celebrations);
      }
    });
  }, []);

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
          // Branch on the typed payload; every event also refreshes the bell.
          let payload: { event?: string } | null = null;
          try {
            payload = JSON.parse(ev.data as string);
          } catch {
            payload = null; // heartbeat sends an empty frame — nothing to do
          }
          if (!payload?.event) return;
          if (
            payload.event === "achievement_awarded" ||
            payload.event === "journey_level_unlocked"
          ) {
            void refreshCelebrations();
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
        void refreshCelebrations();
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
  }, [refreshCelebrations]);

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

  async function handleCelebrationClose(): Promise<void> {
    const current = currentCelebration;
    if (!current || celebrationBusy) return;
    setCelebrationBusy(true);
    setJourneyCelebrationError(null);
    try {
      if (current.type === "achievement") {
        await markAchievementsCelebrated(
          current.celebration.items.map((item) => item.id),
        );
        setAchievementCelebrations((items) =>
          items.filter((item) => item !== current.celebration),
        );
      } else {
        await markJourneyLevelCelebrated(current.celebration.id);
        setJourneyLevelCelebrations((items) =>
          items.filter((item) => item.id !== current.celebration.id),
        );
      }
    } catch {
      if (current.type === "journey-level") {
        setJourneyCelebrationError(
          tJourney("celebration.acknowledge_error"),
        );
      }
    } finally {
      setCelebrationBusy(false);
    }
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
        tabUnread: t("tab_unread"),
        groupToday: t("group_today"),
        groupThisWeek: t("group_this_week"),
        groupEarlier: t("group_earlier"),
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
      <AnimatePresence initial={false} mode="wait">
        {currentCelebration?.type === "achievement" ? (
          <AchievementCelebration
            key={`achievement:${currentCelebration.celebration.kind}:${currentCelebration.celebration.items.map((item) => item.id).join(":")}`}
            celebration={currentCelebration.celebration}
            busy={celebrationBusy}
            onClose={() => void handleCelebrationClose()}
          />
        ) : currentCelebration?.type === "journey-level" ? (
          <JourneySpotlightScene
            key={`journey-level:${currentCelebration.celebration.id}`}
            mode="celebration"
            celebration={currentCelebration.celebration}
            busy={celebrationBusy}
            error={journeyCelebrationError}
            onClose={() => void handleCelebrationClose()}
          />
        ) : null}
      </AnimatePresence>
    </NotificationDrawerProvider>
  );
}
