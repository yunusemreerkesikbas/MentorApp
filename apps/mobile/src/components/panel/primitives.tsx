import { useState, type ReactNode } from "react";
import { CloseCircleIcon } from "@solar-icons/react-native/linear/close-circle";
import {
  KeyboardAvoidingView,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { haptics } from "../../lib/haptics.js";
import { cardShadow } from "../../lib/layout.js";
import { useThemeTokens } from "../../providers/theme-provider.js";
import { AppText } from "../ui/text.js";

/** The web's `--play-radius`: ledges, bubbles and the mood row. */
export const PLAY_RADIUS = 16;

/** A panel card (`PANEL_CARD`): solid surface, hairline border, 20dp radius, soft blue lift. */
export function PanelCard({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const { palette, radii } = useThemeTokens();
  return (
    <View
      style={[
        styles.card,
        cardShadow,
        { backgroundColor: palette.surface, borderColor: palette.border, borderRadius: radii.card },
        style,
      ]}
    >
      {children}
    </View>
  );
}

/** A card's heading (`PANEL_CARD_TITLE`): 16 / 800. */
export function PanelCardTitle({ children }: { children: ReactNode }) {
  return (
    <AppText accessibilityRole="header" style={styles.cardTitle}>
      {children}
    </AppText>
  );
}

/** The panel's 12dp progress bar: sky blue on the play track, green once complete. */
export function ProgressLine({
  value,
  max,
  complete = false,
  label,
}: {
  value: number;
  max: number;
  complete?: boolean;
  label: string;
}) {
  const { palette } = useThemeTokens();
  const ratio = max > 0 ? Math.min(Math.max(value / max, 0), 1) : 0;
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max, now: Math.min(value, max) }}
      style={[styles.track, { backgroundColor: palette.playTrack }]}
    >
      {ratio > 0 ? (
        <View
          style={[
            styles.fill,
            {
              width: `${ratio * 100}%`,
              backgroundColor: complete ? palette.success : palette.ctaPlayBg,
            },
          ]}
        >
          <View style={styles.shine} />
        </View>
      ) : null}
    </View>
  );
}

/**
 * The play ledge (`LEDGE`): the one big action on a card. Filled sky blue with a 4dp edge, or
 * outlined when the day is already done. The label is passed as children so it can carry an icon,
 * a title that truncates and a suffix that does not.
 */
export function LedgeButton({
  children,
  onPress,
  variant = "filled",
  accessibilityLabel,
}: {
  children: (ink: string) => ReactNode;
  onPress: () => void;
  variant?: "filled" | "outline";
  accessibilityLabel: string;
}) {
  const { palette } = useThemeTokens();
  const [pressed, setPressed] = useState(false);
  const filled = variant === "filled";
  const ink = filled ? palette.ctaPlayInk : palette.playSelectedInk;
  const edge = filled ? palette.ctaPlayEdge : palette.playLine;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPressIn={() => {
        setPressed(true);
        haptics.lightImpact();
      }}
      onPressOut={() => setPressed(false)}
      onPress={onPress}
      style={[
        styles.ledge,
        {
          backgroundColor: filled ? palette.ctaPlayBg : palette.surface,
          borderColor: edge,
          borderWidth: filled ? 0 : 2,
          borderBottomWidth: pressed ? 2 : filled ? 4 : 6,
          transform: [{ translateY: pressed ? 2 : 0 }],
        },
      ]}
    >
      {children(ink)}
    </Pressable>
  );
}

export interface SheetAction {
  label: string;
  onPress: () => void;
  /** "danger" draws the label in the danger colour (e.g. "Sil"). */
  tone?: "danger";
}

/**
 * The app's bottom sheet: a solid surface with 28dp top corners over a scrim (DESIGN.md §5 solid
 * overlays). Tapping the scrim or the system back button closes it.
 *
 * ponytail: React Native's own `Modal`, because every sheet here holds brand-styled React Native
 * content (Nunito, ledges, Puhu art). A native sheet would want a native component tree inside.
 */
export function BottomSheet({
  visible,
  onClose,
  closeLabel,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  /** What the scrim says to a screen reader. */
  closeLabel: string;
  children: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const { palette, radii } = useThemeTokens();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={closeLabel}
        onPress={onClose}
        style={[styles.scrim, { backgroundColor: palette.scrim }]}
      />
      <View
        style={[
          styles.sheet,
          {
            backgroundColor: palette.surface,
            borderTopLeftRadius: radii.sheet,
            borderTopRightRadius: radii.sheet,
            paddingBottom: insets.bottom + 12,
          },
        ]}
      >
        {children}
      </View>
    </Modal>
  );
}

/** A small sheet of actions, used where the web opens a popover menu on a path node. */
export function ActionSheet({
  title,
  actions,
  onClose,
}: {
  title: string | null;
  actions: SheetAction[];
  onClose: () => void;
}) {
  const { palette } = useThemeTokens();

  return (
    <BottomSheet visible={title !== null} onClose={onClose} closeLabel={title ?? ""}>
      <AppText numberOfLines={2} style={styles.sheetTitle}>
        {title}
      </AppText>
      {actions.map((action) => (
        <Pressable
          key={action.label}
          accessibilityRole="button"
          onPress={() => {
            haptics.selection();
            onClose();
            action.onPress();
          }}
          style={({ pressed }) => [
            styles.sheetAction,
            { backgroundColor: pressed ? palette.surfaceHover : palette.surfaceAlt },
          ]}
        >
          <AppText
            tone={action.tone === "danger" ? "danger" : "main"}
            style={styles.sheetActionLabel}
          >
            {action.label}
          </AppText>
        </Pressable>
      ))}
    </BottomSheet>
  );
}

/**
 * The web's titled sheet frame: grab handle, centred title with a close button, a hairline, a
 * scrolling body and an optional pinned footer. Sits on the same `Modal` as `BottomSheet`.
 * The root `KeyboardAvoidingView` does not reach inside a `Modal`, so the sheet has its own.
 */
export function FormSheet({
  visible,
  title,
  closeLabel,
  onClose,
  footer,
  children,
}: {
  visible: boolean;
  title: string;
  /** The close button's and the scrim's screen-reader label. */
  closeLabel: string;
  onClose: () => void;
  footer?: ReactNode;
  children: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const { palette, radii } = useThemeTokens();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView behavior="padding" style={styles.formSheetRoot}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={closeLabel}
          onPress={onClose}
          style={[StyleSheet.absoluteFill, { backgroundColor: palette.scrim }]}
        />
        <View
          style={[
            styles.formSheet,
            {
              backgroundColor: palette.surface,
              borderTopLeftRadius: radii.sheet,
              borderTopRightRadius: radii.sheet,
              paddingBottom: footer ? 0 : insets.bottom + 12,
            },
          ]}
        >
          <View style={[styles.grabHandle, { backgroundColor: palette.playLine }]} />
          <View style={styles.formSheetHeader}>
            <AppText accessibilityRole="header" numberOfLines={1} style={styles.formSheetTitle}>
              {title}
            </AppText>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={closeLabel}
              hitSlop={8}
              onPress={onClose}
              style={styles.formSheetClose}
            >
              <CloseCircleIcon size={26} color={palette.secondary} />
            </Pressable>
          </View>
          <View style={[styles.hairline, { backgroundColor: palette.playLine }]} />
          <ScrollView
            style={styles.formSheetBody}
            contentContainerStyle={styles.formSheetBodyContent}
            keyboardShouldPersistTaps="handled"
          >
            {children}
          </ScrollView>
          {footer ? (
            <View
              style={[
                styles.formSheetFooter,
                { borderTopColor: palette.playLine, paddingBottom: insets.bottom + 12 },
              ]}
            >
              {footer}
            </View>
          ) : null}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    padding: 20,
  },
  cardTitle: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "800",
  },
  track: {
    height: 12,
    borderRadius: 6,
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    borderRadius: 6,
  },
  shine: {
    position: "absolute",
    left: 8,
    right: 8,
    top: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: "rgba(255, 255, 255, 0.35)",
  },
  ledge: {
    minHeight: 56,
    borderRadius: PLAY_RADIUS,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  scrim: {
    flex: 1,
  },
  sheet: {
    paddingTop: 20,
    paddingHorizontal: 16,
    gap: 8,
  },
  sheetTitle: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "800",
    paddingHorizontal: 4,
    paddingBottom: 4,
  },
  sheetAction: {
    minHeight: 52,
    borderRadius: PLAY_RADIUS,
    paddingHorizontal: 16,
    justifyContent: "center",
  },
  formSheetRoot: {
    flex: 1,
    justifyContent: "flex-end",
  },
  formSheet: {
    maxHeight: "90%",
  },
  grabHandle: {
    alignSelf: "center",
    width: 36,
    height: 4,
    borderRadius: 2,
    marginTop: 8,
  },
  formSheetHeader: {
    minHeight: 52,
    justifyContent: "center",
    paddingHorizontal: 52,
  },
  formSheetTitle: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "800",
    textAlign: "center",
  },
  formSheetClose: {
    position: "absolute",
    right: 12,
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  hairline: {
    height: StyleSheet.hairlineWidth,
  },
  formSheetBody: {
    flexGrow: 0,
    flexShrink: 1,
  },
  formSheetBodyContent: {
    padding: 16,
    gap: 16,
  },
  formSheetFooter: {
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  sheetActionLabel: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "700",
  },
});
