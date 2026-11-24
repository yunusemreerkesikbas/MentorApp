/** Native mobile push delivery (Expo Push Service wrapping FCM/APNs). */
export const MOBILE_PUSH_PORT = Symbol("MOBILE_PUSH_PORT");

/** Thrown when Expo Push reports an invalid or unregistered device token (`DeviceNotRegistered`). */
export class InvalidMobilePushTokenError extends Error {
  constructor(message = "Invalid or unregistered mobile push token") {
    super(message);
    this.name = "InvalidMobilePushTokenError";
  }
}

export interface MobilePushPort {
  send(input: {
    token: string;
    title: string;
    body: string;
    url?: string;
  }): Promise<void>;
}
