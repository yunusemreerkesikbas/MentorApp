import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { haptics } from "../../lib/haptics.js";
import { useThemeTokens } from "../../providers/theme-provider.js";
import { AppText } from "./text.js";

export interface ChipProps {
  label: string;
  selected?: boolean;
  tone?: "default" | "success" | "warning" | "coach";
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}

export function Chip({
  label,
  selected = false,
  tone = "default",
  onPress,
  style,
}: ChipProps) {
  const { palette, radii, space, touchTargets } = useThemeTokens();

  const bg = selected
    ? palette.ctaPlayBg
    : tone === "success"
      ? palette.successBg
      : tone === "warning"
        ? palette.warningBg
        : tone === "coach"
          ? palette.coachAccentSoft
          : palette.surfaceAlt;

  const ink = selected
    ? palette.ctaPlayInk
    : tone === "success"
      ? palette.success
      : tone === "warning"
        ? palette.warning
        : tone === "coach"
          ? palette.coachAccent
          : palette.secondary;

  const borderColor = selected ? palette.ctaPlayEdge : palette.border;

  const content = (
    <View
      style={[
        styles.pill,
        {
          backgroundColor: bg,
          borderColor,
          borderRadius: radii.pill,
          paddingHorizontal: space.md,
          paddingVertical: space.xs + 2,
          minHeight: onPress ? touchTargets.min : undefined,
        },
        style,
      ]}
    >
      <AppText variant="caption" style={{ color: ink }}>
        {label}
      </AppText>
    </View>
  );

  if (!onPress) return content;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      hitSlop={6}
      onPress={() => {
        haptics.selection();
        onPress();
      }}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "flex-start",
  },
});
