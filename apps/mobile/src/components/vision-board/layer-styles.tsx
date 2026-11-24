import { useState } from "react";
import { VISION_IMAGE_FRAMES, VISION_TEXT_ALIGNS, VISION_TEXT_FONTS, type VisionBoardItem } from "@mentor/types";
import { COLOR_NAMES, TEXT_COLORS } from "@mentor/core/board-palettes";
import { useTranslations } from "../../providers/i18n-provider.js";
import type { TranslationCatalog } from "../../i18n/tr.ts";
import { AppText, Chip } from "../ui/index.js";
import { Wrap } from "./screen.js";

export function LayerStyles({ item, update }: { item: VisionBoardItem; update: (change: (i: VisionBoardItem) => VisionBoardItem) => void }) {
  const t = useTranslations("visionBoard");
  const [fontsOpen, setFontsOpen] = useState(false);
  return <>
    <AppText variant="caption">{t("opacity")}</AppText>
    <Wrap>{[0.25, 0.5, 0.75, 1].map(opacity => <Chip key={opacity} selected={item.opacity === opacity}
      label={Math.round(opacity * 100) + "%"} onPress={() => update(i => ({ ...i, opacity }))} />)}</Wrap>
    {item.kind === "image" && <Wrap>{VISION_IMAGE_FRAMES.map(frame => <Chip key={frame} label={t(`image_frame_${frame}`)}
      selected={item.frame === frame} onPress={() => update(i => i.kind === "image" ? { ...i, frame } : i)} />)}</Wrap>}
    {item.kind === "text" && <>
      <Wrap>
        <Chip label={t("bold")} selected={item.bold} onPress={() => update(i => i.kind === "text" ? { ...i, bold: !i.bold } : i)} />
        <Chip label={t("italic")} selected={item.italic} onPress={() => update(i => i.kind === "text" ? { ...i, italic: !i.italic } : i)} />
        <Chip label={t("font")} selected={fontsOpen} onPress={() => setFontsOpen(!fontsOpen)} />
      </Wrap>
      {fontsOpen && <Wrap>{VISION_TEXT_FONTS.map(font => <Chip key={font} selected={font === item.font} label={t(`font_${font}`)}
        onPress={() => update(i => i.kind === "text" ? { ...i, font } : i)} />)}</Wrap>}
      <Wrap>{VISION_TEXT_ALIGNS.map(align => <Chip key={align} selected={align === item.align} label={t(`align_${align}`)}
        onPress={() => update(i => i.kind === "text" ? { ...i, align } : i)} />)}</Wrap>
      <AppText variant="caption">{t("inkColor")}</AppText>
      <Wrap>{TEXT_COLORS.map(color => <Chip key={color} selected={item.color === color}
        label={t(`color_name_${COLOR_NAMES[color]}` as keyof TranslationCatalog["visionBoard"])}
        onPress={() => update(i => i.kind === "text" ? { ...i, color } : i)} />)}</Wrap>
    </>}
  </>;
}
