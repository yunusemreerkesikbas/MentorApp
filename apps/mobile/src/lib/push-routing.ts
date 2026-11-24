import type { MobilePushPlatform } from "@mentor/types";
import {
  resolveMobileNotificationDestination,
  type MobileNotificationDestination,
} from "./notifications-view.ts";

export function extractPushLinkUrl(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const candidate = (data as Record<string, unknown>)["url"];
  if (typeof candidate !== "string") return null;
  const trimmed = candidate.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function resolvePushNotificationDestination(
  data: unknown,
  studentCoreOnly: boolean,
): MobileNotificationDestination | null {
  const linkUrl = extractPushLinkUrl(data);
  if (!linkUrl) return null;
  return resolveMobileNotificationDestination(linkUrl, studentCoreOnly);
}

/**
 * SDK 53+ dropped remote Android push notifications from Expo Go.
 * Both `appOwnership === "expo"` and `executionEnvironment === "storeClient"` identify Expo Go.
 */
export function isExpoGoRuntime(
  appOwnership?: string | null,
  executionEnvironment?: string | null,
): boolean {
  return appOwnership === "expo" || executionEnvironment === "storeClient";
}

export function resolveMobilePushPlatform(os: string): MobilePushPlatform | null {
  if (os === "ios" || os === "android") return os;
  return null;
}
