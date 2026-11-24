import { StyleSheet, View } from "react-native";
import Svg, { Defs, Path, Pattern, Rect } from "react-native-svg";
import { lightThemeTokens } from "@mentor/ui/tokens";
import type { NotebookCoverStyle } from "@mentor/types";
import { useThemeTokens } from "../../providers/theme-provider.js";
import { AppText } from "../ui/index.js";

export function NotebookCover({ cover, title, subtitle }: { cover: NotebookCoverStyle; title: string; subtitle?: string }) {
  const { scenes, space, radii } = useThemeTokens();
  const wood = scenes.roomStage.LIBRARY;
  const colors = { navy: lightThemeTokens.premiumMark, plum: lightThemeTokens.chipText, forest: wood.accent,
    sand: wood.table, slate: lightThemeTokens.secondary, ink: lightThemeTokens.main };
  const pattern = { cloth: "M0 0H12M0 0V12", kraft: "M0 10L10 0", leather: "M0 6Q3 0 6 6T12 6", matte: "" };
  return <View style={{ width: "100%", aspectRatio: 0.86, maxHeight: 200, paddingVertical: space.md, paddingLeft: space.xl,
    paddingRight: space.sm, justifyContent: "center", overflow: "hidden", borderRadius: radii.inner,
    backgroundColor: colors[cover.color], borderRightWidth: space.xs, borderBottomWidth: space.xs, borderColor: scenes.landingCity.paperNote }}>
    <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
      <Defs><Pattern id="weave" patternUnits="userSpaceOnUse" width={12} height={12}>
        <Path d={pattern[cover.material]} stroke={wood.ink} opacity={0.22} strokeWidth={1}/>
      </Pattern></Defs><Rect width="100%" height="100%" fill="url(#weave)"/>
    </Svg>
    <View style={{ position: "absolute", top: 0, bottom: 0, left: space.xs, width: space.sm, backgroundColor: wood.groundTo, opacity: 0.55 }}/>
    <View style={{ backgroundColor: scenes.landingCity.paperNote, paddingHorizontal: space.sm, paddingVertical: space.md }}>
      <AppText variant="cardTitle" style={{ color: lightThemeTokens.main }}>{title}</AppText>
      {subtitle && <AppText variant="micro" style={{ color: lightThemeTokens.secondary }}>{subtitle}</AppText>}
    </View>
  </View>;
}
