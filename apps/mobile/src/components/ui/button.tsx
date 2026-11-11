import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { haptics } from "../../lib/haptics.js";
import { useThemeTokens } from "../../providers/theme-provider.js";
import { AppText } from "./text.js";

export type ButtonVariant = "primary" | "secondary" | "danger";

export interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * Play-ledge tactile CTA button (`DESIGN.md` §1 Rule 2 & §6):
 * - Primary: sky-blue (`#55ACEE`) fill, `4px` `--cta-play-edge` bottom ledge, deep navy ink (`#0F2233`).
 * - Secondary: solid surface fill, `1px` border + `2px` bottom ledge.
 * - Minimum 48dp touch height, continuous corners, haptic punctuation on press-in.
 */
export function Button({
  label,
  onPress,
  variant = "primary",
  disabled = false,
  loading = false,
  accessibilityLabel,
  style,
}: ButtonProps) {
  const { palette, radii, touchTargets, ledge, space } = useThemeTokens();
  const [pressed, setPressed] = useState(false);
  const isInteractive = !disabled && !loading;

  const colors =
    variant === "primary"
      ? {
          bg: palette.ctaPlayBg,
          edge: palette.ctaPlayEdge,
          ink: palette.ctaPlayInk,
          borderWidth: 0,
          bottomWidth: ledge.primaryBottomWidth,
        }
      : variant === "danger"
        ? {
            bg: palette.danger,
            edge: palette.dangerEdge,
            ink: palette.dangerInk,
            borderWidth: 0,
            bottomWidth: ledge.primaryBottomWidth,
          }
        : {
            bg: palette.surface,
            edge: palette.border,
            ink: palette.main,
            borderWidth: 1,
            bottomWidth: ledge.secondaryBottomWidth,
          };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: !isInteractive, busy: loading }}
      disabled={!isInteractive}
      onPressIn={() => {
        if (!isInteractive) return;
        setPressed(true);
        haptics.lightImpact();
      }}
      onPressOut={() => setPressed(false)}
      onPress={onPress}
      style={[
        styles.base,
        {
          minHeight: touchTargets.comfortable,
          borderRadius: radii.button,
          paddingHorizontal: space.xl,
          backgroundColor: colors.bg,
          borderColor: colors.edge,
          borderWidth: colors.borderWidth,
          borderBottomWidth: pressed ? Math.max(1, colors.bottomWidth - 2) : colors.bottomWidth,
          transform: [{ translateY: pressed ? ledge.pressTranslateY : 0 }],
          opacity: disabled ? 0.55 : 1,
        },
        style,
      ]}
    >
      <View style={styles.content}>
        {loading ? (
          <ActivityIndicator size="small" color={colors.ink} />
        ) : (
          <AppText
            variant="cardTitle"
            style={{ color: colors.ink }}
          >
            {label}
          </AppText>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    justifyContent: "center",
    alignItems: "center",
    borderCurve: "continuous",
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
});
