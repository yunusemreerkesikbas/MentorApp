import { View, type DimensionValue, type StyleProp, type ViewStyle } from "react-native";
import { useThemeTokens } from "../../providers/theme-provider.js";

export interface SkeletonProps {
  width?: DimensionValue;
  height?: DimensionValue;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * Dimension-matched skeleton block (`DESIGN.md` §10) to prevent layout shifts while data resolves.
 */
export function Skeleton({
  width = "100%",
  height = 20,
  borderRadius,
  style,
}: SkeletonProps) {
  const { palette, radii } = useThemeTokens();

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        {
          width,
          height,
          borderRadius: borderRadius ?? radii.inner,
          backgroundColor: palette.surfaceAlt,
          borderCurve: "continuous",
        },
        style,
      ]}
    />
  );
}
