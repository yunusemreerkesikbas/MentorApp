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
  })
  .refine((v) => v.emailEnabled !== undefined || v.pushEnabled !== undefined, {
    message: "At least one preference field is required.",
  });
export type UpdateNotificationPreferencesInput = z.infer<
  typeof updateNotificationPreferencesSchema
>;
