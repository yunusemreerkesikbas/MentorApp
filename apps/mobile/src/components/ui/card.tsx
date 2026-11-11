import type { ReactNode } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { useThemeTokens } from "../../providers/theme-provider.js";

export interface CardProps {
  children: ReactNode;
  variant?: "surface" | "alt" | "coach";
  style?: StyleProp<ViewStyle>;
}

/**
 * Solid surface card (`DESIGN.md` §1 Rule 1 & §6):
 * 100% opaque surface, `1px` border, `20dp` continuous corner radius. Never translucent glass.
 */
export function Card({ children, variant = "surface", style }: CardProps) {
  const { palette, radii, space } = useThemeTokens();

  const backgroundColor =
    variant === "alt"
      ? palette.surfaceAlt
      : variant === "coach"
        ? palette.coachAccentSoft
        : palette.surface;

  const borderColor = variant === "coach" ? palette.coachAccent : palette.border;

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor,
          borderColor,
          borderRadius: radii.card,
          padding: space.lg,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderCurve: "continuous",
  },
});
