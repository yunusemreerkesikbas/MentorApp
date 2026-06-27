"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { UserNotificationDto } from "@mentor/types";
import {
  NotificationDrawerPanel,
  type NotificationDrawerPanelProps,
} from "./notification-drawer-panel.js";
import type {
  NotificationDrawerContextValue,
  NotificationDrawerProviderProps,
  NotificationTab,
} from "./types.js";

const NotificationDrawerContext = createContext<NotificationDrawerContextValue | null>(null);

export function useNotificationDrawer(): NotificationDrawerContextValue {
  const ctx = useContext(NotificationDrawerContext);
  if (!ctx)
    throw new Error("useNotificationDrawer must be used inside NotificationDrawerProvider");
  return ctx;
}

export function NotificationDrawerProvider({
  children,
  items: itemsProp,
  unreadCount,
  onMarkRead,
  onMarkAllRead,
  renderIcon,
  emptyState,
  labels,
}: NotificationDrawerProviderProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<NotificationTab>("ALL");
  const [items, setItems] = useState<UserNotificationDto[]>(itemsProp);
  // Keep items in sync when parent re-fetches
  const prevItemsProp = useRef(itemsProp);
  if (itemsProp !== prevItemsProp.current) {
    prevItemsProp.current = itemsProp;
    setItems(itemsProp);
  }

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen((v) => !v), []);

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

  const value = useMemo<NotificationDrawerContextValue>(
    () => ({ isOpen, open, close, toggle, items, unreadCount, activeTab, setActiveTab, markRead, markAllRead }),
    [isOpen, open, close, toggle, items, unreadCount, activeTab, markRead, markAllRead],
  );

  const panelProps: NotificationDrawerPanelProps = {
    isOpen,
    onClose: close,
    items,
    unreadCount,
    activeTab,
    onTabChange: setActiveTab,
    onMarkRead: markRead,
    onMarkAllRead: markAllRead,
    renderIcon,
    emptyState,
    labels,
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
