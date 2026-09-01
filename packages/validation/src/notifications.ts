import { z } from "zod";

export const pushSubscriptionKeysSchema = z.object({
  p256dh: z.string().min(1).max(512),
  auth: z.string().min(1).max(256),
});

export const pushSubscribeSchema = z.object({
  endpoint: z.string().url().max(2048),
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

export const notificationCategorySchema = z.enum([
  "COACH",
  "PLAN",
  "CONTENT",
  "FORUM",
  "ACHIEVEMENT",
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
