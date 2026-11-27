import { useCallback, useRef, useState } from "react";
import { Modal, Platform, Pressable, StyleSheet, View } from "react-native";
import * as Notifications from "expo-notifications";
import { shouldAskPush, type PushPermissionState } from "../../lib/onboarding-summary.js";
import { registerDeviceForPushNotifications } from "../../lib/push-notifications.js";
import { useThemeTokens } from "../../providers/theme-provider.js";
import { AppText } from "../ui/index.js";
import { PuhuBubble } from "../onboarding-play/index.js";

/** Fixed in both themes (web `--play-scrim` / `--play-scrim-ink`): white ink stays readable on it. */
const SCRIM = "rgba(17, 17, 17, 0.6)";

async function readPushPermission(): Promise<PushPermissionState> {
  if (Platform.OS !== "ios" && Platform.OS !== "android") return "unsupported";
  try {
    const current = await Notifications.getPermissionsAsync();
    // Android 13+: the permission can stay granted while the app's notifications are switched off.
    if (current.granted && current.android?.importance === Notifications.AndroidImportance.NONE) return "denied";
    if (current.granted) return "granted";
    if (current.status === Notifications.PermissionStatus.UNDETERMINED || current.canAskAgain) return "undetermined";
    return "denied";
  } catch {
    return "unsupported";
  }
}

/**
 * The web's `usePushPermissionAsk`: in the "Devam" tap, when the phone will really ask, Puhu's
 * layer opens behind the system prompt. Resolves `true` only when this device got registered;
 * "Şimdilik geç" resolves `false` at once without waiting on the prompt.
 */
export function usePushPermissionAsk() {
  const [open, setOpen] = useState(false);
  const skipRef = useRef<(() => void) | null>(null);

  const ask = useCallback(async (): Promise<boolean> => {
    if (!shouldAskPush(await readPushPermission())) return false;
    const registered = registerDeviceForPushNotifications({ requestPermission: true }).then(
      (result) => result.status === "registered",
    );
    const skipped = new Promise<boolean>((resolve) => {
      skipRef.current = () => resolve(false);
    });
    setOpen(true);
    try {
      return await Promise.race([registered, skipped]);
    } finally {
      skipRef.current = null;
      setOpen(false);
    }
  }, []);

  const dismiss = useCallback(() => skipRef.current?.(), []);
  return { open, ask, dismiss };
}

/** Puhu's context layer over the scrim, with a skip that never waits on the system prompt. */
export function PushPermissionLayer({
  open, title, body, skipLabel, onSkip,
}: {
  open: boolean;
  title: string;
  body: string;
  skipLabel: string;
  onSkip: () => void;
}) {
  const { space } = useThemeTokens();
  return (
    <Modal visible={open} transparent animationType="fade" statusBarTranslucent onRequestClose={onSkip}>
      <View accessibilityViewIsModal accessibilityLabel={title} style={[styles.root, { backgroundColor: SCRIM, paddingHorizontal: space.xl, gap: space.xl }]}>
        <PuhuBubble title={title} sub={body} />
        <Pressable accessibilityRole="button" onPress={onSkip} style={styles.skip}>
          <AppText style={[styles.skipText, { color: "#FFFFFF" }]}>{skipLabel}</AppText>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: "center" },
  skip: { alignSelf: "center", minHeight: 44, justifyContent: "center", paddingHorizontal: 12 },
  skipText: { fontSize: 16, fontWeight: "700" },
});
