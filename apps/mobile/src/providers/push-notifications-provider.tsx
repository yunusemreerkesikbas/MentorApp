import { useCallback, useEffect, useRef, type ReactNode } from "react";
import { useRouter } from "expo-router";
import * as Notifications from "expo-notifications";
import { useQuery } from "@tanstack/react-query";
import { fetchNotificationPreferences } from "../lib/notifications-api.js";
import {
  configureForegroundNotificationHandler,
  ensureAndroidNotificationChannel,
  registerDeviceForPushNotifications,
} from "../lib/push-notifications.js";
import { resolvePushNotificationDestination } from "../lib/push-routing.js";
import { STUDENT_CORE_ONLY } from "../lib/release-scope.js";
import { useAuth } from "./auth-provider.js";

export function PushNotificationsProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { status, user } = useAuth();
  const handledResponseIdsRef = useRef<Set<string>>(new Set());
  const syncedUserIdRef = useRef<string | null>(null);

  const navigateFromResponse = useCallback(
    (response: Notifications.NotificationResponse | null) => {
      if (!response) return;
      const identifier = response.notification.request.identifier;
      if (handledResponseIdsRef.current.has(identifier)) return;
      handledResponseIdsRef.current.add(identifier);

      const dest = resolvePushNotificationDestination(
        response.notification.request.content.data,
        STUDENT_CORE_ONLY,
      );
      if (!dest) return;
      if (dest.pathname.startsWith("/(app)/(tabs)/")) {
        router.navigate(dest as never);
      } else {
        router.push(dest as never);
      }
    },
    [router],
  );

  useEffect(() => {
    configureForegroundNotificationHandler();
    void ensureAndroidNotificationChannel();

    let active = true;
    void Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        if (!active || !response) return;
        navigateFromResponse(response);
        void Notifications.clearLastNotificationResponseAsync().catch(() => {});
      })
      .catch(() => {});

    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      navigateFromResponse(response);
    });

    return () => {
      active = false;
      subscription.remove();
    };
  }, [navigateFromResponse]);

  const prefsQuery = useQuery({
    queryKey: ["notifications", "preferences"],
    queryFn: fetchNotificationPreferences,
    enabled: status === "authenticated" && Boolean(user?.id),
  });

  useEffect(() => {
    if (status !== "authenticated" || !user?.id) {
      syncedUserIdRef.current = null;
      return;
    }
    if (!prefsQuery.data?.pushEnabled) return;
    if (syncedUserIdRef.current === user.id) return;
    syncedUserIdRef.current = user.id;
    void registerDeviceForPushNotifications({ requestPermission: false });
  }, [status, user?.id, prefsQuery.data?.pushEnabled]);

  return <>{children}</>;
}
