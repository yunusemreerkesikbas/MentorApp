/** Shared notification API contracts. */
export interface NotificationPreferencesDto {
  emailEnabled: boolean;
  pushEnabled: boolean;
}

export interface PushSubscriptionKeysDto {
  p256dh: string;
  auth: string;
}

export interface PushSubscriptionInput {
  endpoint: string;
  keys: PushSubscriptionKeysDto;
}

// --- In-app notification inbox (W5 extension) ---

export type NotificationCategory = "COACH" | "PLAN" | "CONTENT" | "FORUM";

export interface UserNotificationDto {
  id: string;
  category: NotificationCategory;
  title: string;
  body: string;
  readAt: string | null;
  linkUrl: string | null;
  createdAt: string;
}

export interface NotificationListDto {
  items: UserNotificationDto[];
  unreadCount: number;
  hasMore: boolean;
}
