import * as Haptics from "expo-haptics";
import { Platform } from "react-native";

const isNative = Platform.OS === "ios" || Platform.OS === "android";

/**
 * Haptics are punctuation (`appllama-app-design-skill` Law 10):
 * - Selection tick when switching tabs or chips
 * - Light impact when pressing a play-ledge CTA
 * - Notification feedback on ritual/session completion or form error
 */
export const haptics = {
  selection(): void {
    if (!isNative) return;
    void Haptics.selectionAsync().catch(() => {});
  },
  lightImpact(): void {
    if (!isNative) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  },
  success(): void {
    if (!isNative) return;
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  },
  error(): void {
    if (!isNative) return;
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
  },
};
