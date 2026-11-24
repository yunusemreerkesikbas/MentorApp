import { Platform } from "react-native";
import { isRunningInExpoGo } from "expo";
import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import * as SecureStore from "expo-secure-store";
import { mobilePushTokenSchema } from "@mentor/validation";
import {
  registerMobilePushToken,
  unregisterMobilePushToken,
} from "./notifications-api.js";
import {
  isExpoGoRuntime,
  resolveMobilePushPlatform,
} from "./push-routing.js";

export const EXPO_PUSH_TOKEN_STORAGE_KEY =
  "mentor.notifications.expo_push_token.v1" as const;

export type PushRegistrationResult =
  | { status: "registered"; token: string }
  | { status: "denied" }
  | { status: "expo_go_unsupported" }
  | { status: "missing_project_id" }
  | { status: "unsupported" }
  | { status: "error" };

let handlerConfigured = false;

export function configureForegroundNotificationHandler(): void {
  if (handlerConfigured) return;
  handlerConfigured = true;
  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
  } catch {
    handlerConfigured = false;
  }
}

export async function ensureAndroidNotificationChannel(): Promise<void> {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync("default", {
    name: "PuhuKoç",
    importance: Notifications.AndroidImportance.HIGH,
    sound: "default",
  }).catch(() => {});
}

export function getEasProjectId(): string | null {
  const easConfig = Constants.easConfig as { projectId?: string } | null;
  const extraEas = (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)
    ?.eas;
  const candidate = easConfig?.projectId ?? extraEas?.projectId;
  return typeof candidate === "string" && candidate.trim().length > 0
    ? candidate.trim()
    : null;
}

export async function registerDeviceForPushNotifications(options: {
  requestPermission: boolean;
}): Promise<PushRegistrationResult> {
  const platform = resolveMobilePushPlatform(Platform.OS);
  if (!platform) return { status: "unsupported" };

  try {
    await ensureAndroidNotificationChannel();

    const current = await Notifications.getPermissionsAsync();
    let granted =
      current.granted ||
      current.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;

    if (!granted && options.requestPermission) {
      const requested = await Notifications.requestPermissionsAsync({
        ios: { allowAlert: true, allowBadge: true, allowSound: true },
      });
      granted =
        requested.granted ||
        requested.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
    }

    if (!granted) return { status: "denied" };

    const constantsRecord = Constants as {
      appOwnership?: string | null;
      executionEnvironment?: string | null;
    };
    if (
      platform === "android" &&
      (isRunningInExpoGo() ||
        isExpoGoRuntime(constantsRecord.appOwnership, constantsRecord.executionEnvironment))
    ) {
      return { status: "expo_go_unsupported" };
    }

    const projectId = getEasProjectId();
    if (!projectId) return { status: "missing_project_id" };

    const tokenResult = await Notifications.getExpoPushTokenAsync({ projectId });
    const parsed = mobilePushTokenSchema.safeParse(tokenResult.data);
    if (!parsed.success) return { status: "error" };

    await registerMobilePushToken({ token: parsed.data, platform });
    await SecureStore.setItemAsync(EXPO_PUSH_TOKEN_STORAGE_KEY, parsed.data).catch(() => {});
    return { status: "registered", token: parsed.data };
  } catch {
    return { status: "error" };
  }
}

export async function unregisterCachedPushToken(): Promise<void> {
  const token = await SecureStore.getItemAsync(EXPO_PUSH_TOKEN_STORAGE_KEY).catch(
    () => null,
  );
  if (token && mobilePushTokenSchema.safeParse(token).success) {
    await unregisterMobilePushToken(token).catch(() => {});
  }
  await SecureStore.deleteItemAsync(EXPO_PUSH_TOKEN_STORAGE_KEY).catch(() => {});
}
