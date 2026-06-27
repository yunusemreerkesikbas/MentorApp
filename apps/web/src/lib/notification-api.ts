/**
 * In-app notification inbox API calls.
 * Raw fetch pattern (forum precedent — api-client regenerate deferred).
 * Uses the shared `http()` wrapper for auth token + locale headers.
 */
import { http } from "@mentor/api-client";
import type {
  NotificationCategory,
  NotificationListDto,
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
