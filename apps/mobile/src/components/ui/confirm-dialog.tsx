import { Modal, Pressable, StyleSheet, View } from "react-native";
import { useThemeTokens } from "../../providers/theme-provider.js";
import { Button } from "./button.js";
import { AppText } from "./text.js";

/**
 * A centred yes/no dialog over the scrim, the mobile twin of the web's `useMentorDialog` confirm.
 * The scrim and the system back button cancel.
 */
export function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel,
  cancelLabel,
  destructive = false,
  onConfirm,
  onCancel,
}: {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const { palette, radii } = useThemeTokens();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onCancel}
    >
      <View style={styles.root}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={cancelLabel}
          onPress={onCancel}
          style={[StyleSheet.absoluteFill, { backgroundColor: palette.scrim }]}
        />
        <View
          accessibilityViewIsModal
          style={[styles.card, { backgroundColor: palette.surface, borderRadius: radii.card }]}
        >
          <AppText accessibilityRole="header" style={styles.title}>
            {title}
          </AppText>
          <AppText tone="secondary">{message}</AppText>
          <View style={styles.actions}>
            <Button
              label={cancelLabel}
              variant="secondary"
              onPress={onCancel}
              style={styles.action}
            />
            <Button
              label={confirmLabel}
              variant={destructive ? "danger" : "primary"}
              onPress={onConfirm}
              style={styles.action}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: "center",
    padding: 24,
  },
  card: {
    padding: 20,
    gap: 8,
  },
  title: {
    fontSize: 17,
    lineHeight: 23,
    fontWeight: "800",
  },
  actions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 12,
  },
  action: {
    flex: 1,
  },
});
