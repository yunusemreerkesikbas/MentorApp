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

export type NotificationCategory = "COACH" | "PLAN" | "CONTENT" | "FORUM" | "ACHIEVEMENT";

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

/** POST /v1/notifications/session-return-reminder response. */
export interface SessionReturnReminderDto {
  /** True when a new job was enqueued; false when already scheduled for that target day. */
  scheduled: boolean;
  alreadyScheduled: boolean;
  /** ISO datetime when the reminder job is due (null when alreadyScheduled). */
  runAt: string | null;
}
