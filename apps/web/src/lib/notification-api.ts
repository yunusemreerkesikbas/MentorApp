/**
 * In-app notification inbox API calls.
 * Raw fetch pattern (forum precedent — api-client regenerate deferred).
 * Uses the shared `http()` wrapper for auth token + locale headers.
 */
import { http } from "@mentor/api-client";
import type {
  NotificationCategory,
  NotificationListDto,
  SessionReturnReminderDto,
  UserNotificationDto,
} from "@mentor/types";

export async function listNotifications(
  category?: NotificationCategory,
  page = 1,
): Promise<NotificationListDto> {
  const params = new URLSearchParams({ page: String(page) });
  if (category) params.set("category", category);
  return http<NotificationListDto>(`/v1/notifications?${params.toString()}`);
}

export async function markNotificationRead(id: string): Promise<UserNotificationDto | null> {
  return http<UserNotificationDto | null>(`/v1/notifications/${encodeURIComponent(id)}/read`, {
    method: "PATCH",
  });
}

export async function markAllNotificationsRead(): Promise<void> {
  await http<void>("/v1/notifications/read-all", { method: "PATCH" });
}

export async function markNotificationUnread(id: string): Promise<UserNotificationDto> {
  return http<UserNotificationDto>(`/v1/notifications/${encodeURIComponent(id)}/unread`, { method: "PATCH" });
}

export async function deleteNotification(id: string): Promise<void> {
  await http<void>(`/v1/notifications/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export async function getNotificationStreamToken(): Promise<string> {
  const res = await http<{ token: string }>("/v1/notifications/stream-token", { method: "POST" });
  return res.token;
}

/** Opt-in soft return after a study session (~24h reminder; mobile-ready). */
export async function scheduleSessionReturnReminder(
  subject?: string | null,
): Promise<SessionReturnReminderDto> {
  const body =
    subject?.trim()
      ? JSON.stringify({ subject: subject.trim().slice(0, 80) })
      : JSON.stringify({});
  return http<SessionReturnReminderDto>("/v1/notifications/session-return-reminder", {
    method: "POST",
    body,
  });
}
