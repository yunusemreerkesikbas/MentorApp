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
