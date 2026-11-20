import { Pressable, type StyleProp, type ViewStyle } from "react-native";
import { useThemeTokens } from "../../providers/theme-provider.js";
import { AppText } from "../ui/index.js";

export function AnalysisLink({ label, onPress, style }: {
  label: string;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const { palette, touchTargets } = useThemeTokens();
  return (
    <Pressable accessibilityRole="button" onPress={onPress}
      style={[{ alignSelf: "flex-start", minHeight: touchTargets.min, justifyContent: "center" }, style]}>
      <AppText variant="caption" style={{ color: palette.playSelectedInk, fontWeight: "800" }}>{label}</AppText>
    </Pressable>
  );
}
