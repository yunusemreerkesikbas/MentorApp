import { useState } from "react";
import { Pressable, View } from "react-native";
import { VISION_BOARD_FRAMES, VISION_BOARD_TEXTURES, VISION_STICKERS, type VisionBoardDoc, type VisionSticker } from "@mentor/types";
import { BOARD_COLORS, COLOR_NAMES } from "@mentor/core/board-palettes";
import { BOARD_TEMPLATE_IDS, applyTemplate, type BoardTemplateId } from "@mentor/core/board-templates";
import { AppText, Chip } from "../ui/index.js";
import { useTranslations } from "../../providers/i18n-provider.js";
import type { TranslationCatalog } from "../../i18n/tr.ts";
import { useThemeTokens } from "../../providers/theme-provider.js";
import { Wrap } from "./screen.js";

type Key = keyof TranslationCatalog["visionBoard"];
type Tool = "layout" | "palette" | "stickers" | "appearance";
export function BoardChoices({ doc, edit, addSticker, template, onTemplate }: {
  doc: VisionBoardDoc; edit: (fn: (d: VisionBoardDoc) => VisionBoardDoc) => void;
  addSticker: (s: VisionSticker) => void; template: BoardTemplateId | null; onTemplate: (id: BoardTemplateId) => void;
}) {
  const [tool, setTool] = useState<Tool | null>(null);
  const t = useTranslations("visionBoard");
  const { palette, radii, space, touchTargets } = useThemeTokens();
  return <View style={{ gap: space.sm }}>
    <Wrap>{(["layout", "palette", "stickers", "appearance"] as const).map(key =>
      <Chip key={key} label={t(key)} selected={tool === key} onPress={() => setTool(tool === key ? null : key)} />)}</Wrap>
    {tool === "layout" && <Wrap>{BOARD_TEMPLATE_IDS.map(id =>
      <Chip key={id} label={t(`template_${id}`)} selected={template === id} onPress={() => {
        edit(d => applyTemplate(d, id)); onTemplate(id);
      }} />)}</Wrap>}
    {tool === "palette" && <Wrap>{BOARD_COLORS.map(color => {
      const selected = doc.background.value === color;
      return <Pressable key={color} accessibilityRole="button" accessibilityState={{ selected }}
        accessibilityLabel={t(`color_name_${COLOR_NAMES[color]}` as Key)}
        onPress={() => edit(d => ({ ...d, background: { kind: "color", value: color } }))}
        style={{
          minHeight: touchTargets.min, minWidth: touchTargets.min, padding: space.xs, borderRadius: radii.inner,
          borderWidth: 2, borderColor: selected ? palette.main : palette.border,
        }}>
        <View style={{ flex: 1, borderRadius: radii.inner - space.xs, backgroundColor: color }} />
      </Pressable>;
    })}</Wrap>}
    {tool === "stickers" && <Wrap>{VISION_STICKERS.map(asset =>
      <Chip key={asset} label={t((asset.startsWith("MASCOT_") ? "career_" + asset.slice(7) : "sticker_" + asset.toLowerCase()) as Key)}
        onPress={() => { addSticker(asset); setTool(null); }} />)}</Wrap>}
    {tool === "appearance" && <>
      <AppText variant="caption">{t("frame")}</AppText>
      <Wrap>{VISION_BOARD_FRAMES.map(frame => <Chip key={frame} selected={doc.frame === frame} label={t(`frame_${frame}`)}
        onPress={() => edit(d => ({ ...d, frame }))} />)}</Wrap>
      <AppText variant="caption">{t("texture")}</AppText>
      <Wrap>{VISION_BOARD_TEXTURES.map(value => <Chip key={value} selected={doc.background.value === value} label={t(`texture_${value}`)}
        onPress={() => edit(d => ({ ...d, background: { kind: "texture", value } }))} />)}</Wrap>
    </>}
  </View>;
}
