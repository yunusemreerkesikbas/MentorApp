/** Shared notification API contracts. */
export interface NotificationPreferencesDto {
  emailEnabled: boolean;
  pushEnabled: boolean;
  /** Commercial messages (campaigns, discounts) — off silences every channel, inbox included. */
  campaignsEnabled: boolean;
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

export type NotificationCategory =
  | "COACH"
  | "PLAN"
  | "CONTENT"
  | "FORUM"
  | "ACHIEVEMENT"
  /** Human coach relationship: invite accepted, homework assigned, link ended (W8). */
  | "MENTORSHIP"
  /** Team-authored broadcast from the admin panel (W5 announcements). */
  | "SYSTEM";

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

// --- Admin announcements (team-authored broadcast → SYSTEM notifications) ---

export type AnnouncementAudience =
  | { kind: "ALL" }
  | { kind: "EXAM_TYPE"; examType: "KPSS" | "YKS" | "LGS" };

/** DRAFT → SENDING (job queued/fanning out) → SENT. */
export type AnnouncementStatus = "DRAFT" | "SENDING" | "SENT";

export interface AdminAnnouncementDto {
  id: string;
  title: string;
  body: string;
  linkUrl: string | null;
  audience: AnnouncementAudience;
  status: AnnouncementStatus;
  scheduledAt: string | null;
  sentAt: string | null;
  recipientCount: number;
  createdAt: string;
}
