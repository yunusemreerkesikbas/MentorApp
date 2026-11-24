import { http } from "@mentor/api-client";
import type {
  MobilePushTokenInput,
  NotificationCategory,
  NotificationListDto,
  NotificationPreferencesDto,
  SessionReturnReminderDto,
  UserNotificationDto,
} from "@mentor/types";

export async function listNotifications(
  category?: NotificationCategory,
  page = 1,
): Promise<NotificationListDto> {
  const qs = new URLSearchParams({ page: String(page) });
  if (category) qs.set("category", category);
  return (await http<NotificationListDto>(
    `/v1/notifications?${qs.toString()}`,
  )) as NotificationListDto;
}

export async function markNotificationRead(
  id: string,
): Promise<UserNotificationDto> {
  return (await http<UserNotificationDto>(
    `/v1/notifications/${encodeURIComponent(id)}/read`,
    { method: "PATCH" },
  )) as UserNotificationDto;
}

export async function markNotificationUnread(
  id: string,
): Promise<UserNotificationDto> {
  return (await http<UserNotificationDto>(
    `/v1/notifications/${encodeURIComponent(id)}/unread`,
    { method: "PATCH" },
  )) as UserNotificationDto;
}

export async function markAllNotificationsRead(): Promise<void> {
  await http<void>("/v1/notifications/read-all", { method: "PATCH" });
}

export async function deleteNotification(id: string): Promise<void> {
  await http<void>(`/v1/notifications/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

export async function fetchNotificationPreferences(): Promise<NotificationPreferencesDto> {
  return (await http<NotificationPreferencesDto>(
    "/v1/notifications/preferences",
  )) as NotificationPreferencesDto;
}

export async function updateNotificationPreferences(
  patch: Partial<NotificationPreferencesDto>,
): Promise<NotificationPreferencesDto> {
  return (await http<NotificationPreferencesDto>(
    "/v1/notifications/preferences",
    {
      method: "PATCH",
      body: JSON.stringify(patch),
    },
  )) as NotificationPreferencesDto;
}

export async function registerMobilePushToken(
  input: MobilePushTokenInput,
): Promise<void> {
  await http<void>("/v1/notifications/mobile-push-tokens", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function unregisterMobilePushToken(token: string): Promise<void> {
  await http<void>("/v1/notifications/mobile-push-tokens", {
    method: "DELETE",
    body: JSON.stringify({ token }),
  });
}

export async function scheduleSessionReturnReminder(
  subject?: string | null,
): Promise<SessionReturnReminderDto> {
  // The endpoint validates a JSON object; a POST without a body is rejected with 400.
  const trimmed = subject?.trim();
  return (await http<SessionReturnReminderDto>(
    "/v1/notifications/session-return-reminder",
    {
      method: "POST",
      body: JSON.stringify(trimmed ? { subject: trimmed.slice(0, 80) } : {}),
    },
  )) as SessionReturnReminderDto;
}
