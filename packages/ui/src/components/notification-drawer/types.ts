import type { ReactNode } from "react";
import type { NotificationCategory, UserNotificationDto } from "@mentor/types";

export type NotificationTab = "ALL" | NotificationCategory;

export interface NotificationDrawerLabels {
  title: string;
  markAllRead: string;
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
  open(): void;
  close(): void;
  toggle(): void;
  items: UserNotificationDto[];
  unreadCount: number;
  activeTab: NotificationTab;
  setActiveTab(tab: NotificationTab): void;
  markRead(id: string): void;
  markAllRead(): void;
}

export interface NotificationDrawerProviderProps {
  children: ReactNode;
  items: UserNotificationDto[];
  unreadCount: number;
  onMarkRead?: (id: string) => Promise<void>;
  onMarkAllRead?: () => Promise<void>;
  /** Renders the icon for a notification item (category → ReactNode). */
  renderIcon?: (category: NotificationCategory) => ReactNode;
  /** Custom empty state (defaults to built-in text empty state). */
  emptyState?: ReactNode;
  labels: NotificationDrawerLabels;
}
