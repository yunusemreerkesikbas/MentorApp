"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";
import type { UserNotificationDto } from "@mentor/types";
import {
  NotificationDrawerPanel,
  type NotificationDrawerPanelProps,
} from "./notification-drawer-panel.js";
import type {
  NotificationDrawerContextValue,
  NotificationDrawerDesktopSide,
  NotificationDrawerProviderProps,
  NotificationTab,
} from "./types.js";

const NotificationDrawerContext =
  createContext<NotificationDrawerContextValue | null>(null);

export function useNotificationDrawer(): NotificationDrawerContextValue {
  const ctx = useContext(NotificationDrawerContext);
  if (!ctx)
    throw new Error(
      "useNotificationDrawer must be used inside NotificationDrawerProvider",
    );
  return ctx;
}

export function NotificationDrawerProvider({
  children,
  items: itemsProp,
  unreadCount,
  onMarkRead,
  onMarkUnread,
  onMarkAllRead,
  onDelete,
  onNotificationClick,
  renderIcon,
  emptyState,
  labels,
}: NotificationDrawerProviderProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<NotificationTab>("ALL");
  const [desktopSide, setDesktopSide] = useState<NotificationDrawerDesktopSide>("left");
  const [items, setItems] = useState<UserNotificationDto[]>(itemsProp);
  // Keep items in sync when parent re-fetches
  const prevItemsProp = useRef(itemsProp);
  if (itemsProp !== prevItemsProp.current) {
    prevItemsProp.current = itemsProp;
    setItems(itemsProp);
  }

  const open = useCallback((side: NotificationDrawerDesktopSide = "left") => {
    setDesktopSide(side);
    setIsOpen(true);
  }, []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback((side: NotificationDrawerDesktopSide = "left") => {
    setDesktopSide(side);
    setIsOpen((value) => !value);
  }, []);

  const markRead = useCallback(
    (id: string) => {
      setItems((prev) =>
        prev.map((n) =>
          n.id === id ? { ...n, readAt: new Date().toISOString() } : n,
        ),
      );
      onMarkRead?.(id).catch(() => {
        // revert on failure
        setItems(itemsProp);
      });
    },
    [onMarkRead, itemsProp],
  );

  const markAllRead = useCallback(() => {
    const now = new Date().toISOString();
    setItems((prev) => prev.map((n) => ({ ...n, readAt: n.readAt ?? now })));
    onMarkAllRead?.().catch(() => {
      setItems(itemsProp);
    });
  }, [onMarkAllRead, itemsProp]);

  const markUnread = useCallback(
    (id: string) => {
      setItems((prev) =>
        prev.map((n) => (n.id === id ? { ...n, readAt: null } : n)),
      );
      onMarkUnread?.(id).catch(() => {
        setItems(itemsProp);
      });
    },
    [onMarkUnread, itemsProp],
  );

  const deleteItem = useCallback(
    (id: string) => {
      setItems((prev) => prev.filter((n) => n.id !== id));
      onDelete?.(id).catch(() => {
        setItems(itemsProp);
      });
    },
    [onDelete, itemsProp],
  );

  const clickItem = useCallback(
    (notification: UserNotificationDto) => {
      if (notification.readAt === null) markRead(notification.id);
      close();
      onNotificationClick?.(notification);
    },
    [markRead, close, onNotificationClick],
  );

  const value = useMemo<NotificationDrawerContextValue>(
    () => ({
      isOpen,
      open,
      close,
      toggle,
      items,
      unreadCount,
      activeTab,
      setActiveTab,
      markRead,
      markUnread,
      markAllRead,
      deleteItem,
      clickItem,
    }),
    [
      isOpen,
      open,
      close,
      toggle,
      items,
      unreadCount,
      activeTab,
      markRead,
      markUnread,
      markAllRead,
      deleteItem,
      clickItem,
    ],
  );

  const panelProps: NotificationDrawerPanelProps = {
    isOpen,
    onClose: close,
    items,
    unreadCount,
    activeTab,
    onTabChange: setActiveTab,
    onMarkRead: markRead,
    onMarkUnread: markUnread,
    onMarkAllRead: markAllRead,
    onDelete: deleteItem,
    onClickItem: clickItem,
    renderIcon,
    emptyState,
    labels,
    desktopSide,
  };

  return (
    <NotificationDrawerContext.Provider value={value}>
      {children}
      <NotificationDrawerPanel {...panelProps} />
    </NotificationDrawerContext.Provider>
  );
}

export { NotificationDrawerContext };
export type { NotificationDrawerContextValue } from "./types.js";
