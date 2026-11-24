import { Image, type ImageSource } from "expo-image";
import { Platform, StyleSheet, Text, View, type TextStyle, type ViewStyle } from "react-native";
import Svg, { Path } from "react-native-svg";
import { STICKER_ART } from "@mentor/core/board-stickers";
import { lightThemeTokens } from "@mentor/ui/tokens";
import type { VisionBoardImageItem, VisionBoardItem, VisionBoardTextItem } from "@mentor/types";
import { fontFamilyFor } from "../../lib/fonts.js";
import { boardAssets } from "./board-assets.js";

const stickerColors: Record<string, string> = {
  "var(--color-star)": lightThemeTokens.star,
  "var(--color-streak)": lightThemeTokens.streak,
  "var(--color-chip)": lightThemeTokens.chip,
  "var(--color-accent)": lightThemeTokens.accent,
  "var(--color-danger)": lightThemeTokens.danger,
  "var(--color-success)": lightThemeTokens.success,
  "var(--color-main)": lightThemeTokens.main,
};

export type BoardAssetStatus = "ready" | "unavailable";

export function boardAssetSource(item: VisionBoardItem) {
  if (item.kind !== "sticker") return undefined;
  const art = STICKER_ART[item.asset];
  return art.kind === "image" ? boardAssets[art.src] : undefined;
}

function boardFont(item: VisionBoardTextItem): TextStyle {
  const weight = item.bold ? "700" : "400";
  switch (item.font) {
    case "script":
    case "elegant":
      return { fontFamily: "Caveat_700Bold" };
    case "serif":
    case "classic":
    case "slab":
      return { fontFamily: Platform.OS === "ios" ? "Georgia" : "serif", fontWeight: weight };
    case "mono":
      return { fontFamily: Platform.OS === "ios" ? "Courier New" : "monospace", fontWeight: weight };
    case "condensed":
    case "impact":
      return {
        fontFamily: Platform.OS === "ios" ? "AvenirNextCondensed" : "sans-serif-condensed",
        fontWeight: item.font === "impact" ? "900" : weight,
      };
    case "rounded":
      return { fontFamily: fontFamilyFor(item.bold ? "800" : "600") };
    case "heading":
      return { fontFamily: fontFamilyFor(item.bold ? "900" : "600") };
    default:
      return { fontFamily: fontFamilyFor(weight) };
  }
}

function TextArt({ item, scale }: { item: VisionBoardTextItem; scale: number }) {
  const bg = item.background;
  return (
    <View style={{
      flex: 1, justifyContent: "center",
      alignItems: item.align === "left" ? "flex-start" : item.align === "right" ? "flex-end" : "center",
    }}>
      <View style={{ maxWidth: "100%", paddingHorizontal: (bg?.padding ?? 0) * scale,
        paddingVertical: (bg?.padding ?? 0) * scale * 0.6 }}>
        {bg && <View style={[StyleSheet.absoluteFill, {
          backgroundColor: bg.color, opacity: bg.opacity, borderRadius: bg.radius * scale,
        }]} />}
        <Text allowFontScaling={false} style={{
          ...boardFont(item), fontStyle: item.italic ? "italic" : "normal",
          fontSize: item.size * scale, color: item.color, textAlign: item.align,
          lineHeight: item.size * item.lineHeight * scale, letterSpacing: item.letterSpacing * scale,
          includeFontPadding: false,
        }}>{item.text}</Text>
      </View>
    </View>
  );
}

function photoFrame(frame: VisionBoardImageItem["frame"], scale: number): ViewStyle {
  switch (frame) {
    case "polaroid":
      return { backgroundColor: "#fff", padding: 14 * scale, paddingBottom: 52 * scale };
    case "white":
      return { backgroundColor: "#fff", padding: 12 * scale };
    case "rounded":
      return { borderRadius: 28 * scale, overflow: "hidden" };
    default:
      return {};
  }
}

export function BoardItemArt({ item, scale, source, onAssetStatus }: {
  item: VisionBoardItem;
  scale: number;
  source?: ImageSource | number;
  onAssetStatus?: (status: BoardAssetStatus) => void;
}) {
  if (item.kind === "text") return <TextArt item={item} scale={scale} />;
  const art = item.kind === "sticker" ? STICKER_ART[item.asset] : null;
  if (art?.kind === "path") {
    return <Svg width="100%" height="100%" viewBox="0 0 100 100">
      <Path d={art.path} fill={stickerColors[art.fill] ?? art.fill} fillRule={art.fillRule} />
    </Svg>;
  }
  const image = source ? <Image source={source} style={{ flex: 1 }}
    contentFit={item.kind === "image" ? "cover" : "contain"}
    cachePolicy={item.kind === "image" ? "none" : undefined}
    onDisplay={() => onAssetStatus?.("ready")}
    onError={() => onAssetStatus?.("unavailable")} /> : null;
  if (item.kind !== "image") return image;
  return (
    <View style={[{ flex: 1 }, photoFrame(item.frame, scale)]}>
      {image ?? <View style={{ flex: 1, backgroundColor: "#dad9d5" }} />}
      {item.frame === "tape" && <View style={{
        position: "absolute", top: -16 * scale, left: "50%",
        width: 120 * scale, height: 38 * scale, marginLeft: -60 * scale,
        transform: [{ rotate: "-4deg" }], backgroundColor: "rgba(255, 236, 179, 0.72)",
      }} />}
    </View>
  );
}
