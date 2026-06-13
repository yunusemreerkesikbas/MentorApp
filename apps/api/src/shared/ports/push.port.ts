/** Web push delivery (MVP bridge until native push in Phase 2). */
export const PUSH_PORT = Symbol("PUSH_PORT");

export interface PushSubscriptionKeys {
  p256dh: string;
  auth: string;
}

export interface PushPort {
  send(input: {
    endpoint: string;
    keys: PushSubscriptionKeys;
    title: string;
    body: string;
    url?: string;
  }): Promise<void>;
}
