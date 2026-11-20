import { StyleSheet, View } from "react-native";
import Svg, { Defs, Ellipse, RadialGradient, Rect, Stop } from "react-native-svg";
import { blobs, blobsDark } from "@mentor/ui/tokens";
import { useThemeTokens } from "../../providers/theme-provider.js";

export function AmbientBackdrop() {
  const { mode, palette } = useThemeTokens();
  const glow = mode === "dark" ? blobsDark : blobs;
  return <View pointerEvents="none" accessible={false} style={StyleSheet.absoluteFill}>
    <Svg width="100%" height="100%" viewBox="0 0 411 850" preserveAspectRatio="none">
      <Defs>
        {(["pink", "blue", "cyan"] as const).map((color) => <RadialGradient key={color} id={color}>
          <Stop offset="0" stopColor={glow[color]} stopOpacity={glow[`${color}Opacity`]} />
          <Stop offset="1" stopColor={glow[color]} stopOpacity={0} />
        </RadialGradient>)}
      </Defs>
      <Rect width="411" height="850" fill={palette.surface} />
      <Ellipse cx="30" cy="100" rx="330" ry="330" fill="url(#pink)" />
      <Ellipse cx="400" cy="450" rx="370" ry="440" fill="url(#blue)" />
      <Ellipse cx="100" cy="800" rx="350" ry="400" fill="url(#cyan)" />
    </Svg>
  </View>;
}
