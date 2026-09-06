import { z } from "zod";

/** Browser push services only; never accept a caller-selected webhook destination. */
export function isTrustedPushEndpoint(endpoint: string): boolean {
  try {
    const url = new URL(endpoint);
    if (
      url.protocol !== "https:" || (url.port !== "" && url.port !== "443") ||
      url.username !== "" || url.password !== "" || url.hash !== ""
    ) return false;
    const host = url.hostname;
    return host === "fcm.googleapis.com" || host === "updates.push.services.mozilla.com" ||
      host.endsWith(".push.apple.com") || host.endsWith(".notify.windows.com");
  } catch {
    return false;
  }
}

export const pushEndpointSchema = z.string().url().max(2048).refine(isTrustedPushEndpoint);

export const pushSubscriptionKeysSchema = z.object({
  p256dh: z.string().min(1).max(512),
  auth: z.string().min(1).max(256),
});

export const pushSubscribeSchema = z.object({
  endpoint: pushEndpointSchema,
  keys: pushSubscriptionKeysSchema,
});
export type PushSubscribeInput = z.infer<typeof pushSubscribeSchema>;

export const pushUnsubscribeSchema = z.object({
  endpoint: z.string().url().max(2048),
});
export type PushUnsubscribeInput = z.infer<typeof pushUnsubscribeSchema>;

export const updateNotificationPreferencesSchema = z
  .object({
    emailEnabled: z.boolean().optional(),
    pushEnabled: z.boolean().optional(),
    campaignsEnabled: z.boolean().optional(),
  })
  .refine(
    (v) =>
      v.emailEnabled !== undefined ||
      v.pushEnabled !== undefined ||
      v.campaignsEnabled !== undefined,
    { message: "At least one preference field is required." },
  );
export type UpdateNotificationPreferencesInput = z.infer<
  typeof updateNotificationPreferencesSchema
>;

/**
 * Must list every `NotificationCategory` in `@mentor/types` (packages/types/src/notifications.ts).
 * `NotificationsService.toDto` parses every stored row's category through this schema on every
 * read, so a category missing here doesn't just reject a `?category=` filter — it 500s
 * `GET /v1/notifications` outright for anyone with a row of that category in their inbox. That gap
 * is exactly how `MENTORSHIP` went unnoticed since APP-063: the route had no test that put a
 * MENTORSHIP-category row in an inbox and then read it back (mentorship.e2e-spec.ts now does).
 */
export const notificationCategorySchema = z.enum([
  "COACH",
  "PLAN",
  "CONTENT",
  "FORUM",
  "ACHIEVEMENT",
  "MENTORSHIP",
  "SYSTEM",
]);
export type NotificationCategoryInput = z.infer<typeof notificationCategorySchema>;

export const listNotificationsSchema = z.object({
  category: notificationCategorySchema.optional(),
  page: z.coerce.number().int().min(1).default(1),
});
export type ListNotificationsInput = z.infer<typeof listNotificationsSchema>;

export const notificationIdParamSchema = z.object({
  id: z.string().uuid(),
});
export type NotificationIdParamInput = z.infer<typeof notificationIdParamSchema>;

/** Opt-in “remind me tomorrow” after a study session (API-first soft return). */
export const scheduleSessionReturnReminderSchema = z.object({
  subject: z.string().trim().min(1).max(80).optional(),
});
export type ScheduleSessionReturnReminderInput = z.infer<
  typeof scheduleSessionReturnReminderSchema
>;
