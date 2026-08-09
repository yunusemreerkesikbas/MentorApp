import type * as React from "react";
import type { NotificationCategory, UserNotificationDto } from "@mentor/types";

export type NotificationTab = "ALL" | NotificationCategory;
export type NotificationDrawerDesktopSide = "left" | "right";

export interface NotificationDrawerLabels {
  title: string;
  markAllRead: string;
  markRead: string;
  markUnread: string;
  deleteItem: string;
  close: string;
  tabAll: string;
  tabCoach: string;
  tabPlan: string;
  emptyTitle: string;
  emptyBody: string;
  timeJustNow: string;
  timeHoursAgo(count: number): string;
  timeYesterday: string;
  timeDaysAgo(count: number): string;
  /** Unread count suffix for the bell aria-label. e.g. "okunmamış" / "unread" */
  unreadLabel: string;
}

export interface NotificationDrawerContextValue {
  isOpen: boolean;
  open(side?: NotificationDrawerDesktopSide): void;
  close(): void;
  toggle(side?: NotificationDrawerDesktopSide): void;
  items: UserNotificationDto[];
  unreadCount: number;
  activeTab: NotificationTab;
  setActiveTab(tab: NotificationTab): void;
  markRead(id: string): void;
  markUnread(id: string): void;
  markAllRead(): void;
  deleteItem(id: string): void;
  clickItem(notification: UserNotificationDto): void;
}

export interface NotificationDrawerProviderProps {
  children: React.ReactNode;
  items: UserNotificationDto[];
  unreadCount: number;
  onMarkRead?: (id: string) => Promise<void>;
  onMarkUnread?: (id: string) => Promise<void>;
  onMarkAllRead?: () => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
  /** Called when a notification row is tapped — navigate to linkUrl or a category fallback. */
  onNotificationClick?: (notification: UserNotificationDto) => void;
  /** Renders the icon for a notification item (category → React.ReactNode). */
  renderIcon?: (category: NotificationCategory) => React.ReactNode;
  /** Custom empty state (defaults to built-in text empty state). */
  emptyState?: React.ReactNode;
  labels: NotificationDrawerLabels;
}
