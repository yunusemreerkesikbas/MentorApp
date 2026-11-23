import { View } from "react-native";
import { NOTEBOOK_PAGE_CANVAS, type NotebookPageItem } from "@mentor/types";
import { useTranslations } from "../../providers/i18n-provider.js";
import { useThemeTokens } from "../../providers/theme-provider.js";
import { AppText, Chip } from "../ui/index.js";

export function NotebookLayerTools({ item, change, remove }: {
  item: NotebookPageItem; change: (item: NotebookPageItem) => void; remove: () => void;
}) {
  const t = useTranslations("notebooks");
  const b = useTranslations("visionBoard");
  const { space } = useThemeTokens();
  const move = (dx: number, dy: number) => change({ ...item,
    x: Math.min(Math.max(0, NOTEBOOK_PAGE_CANVAS.width - item.width), Math.max(0, item.x + dx)),
    y: Math.min(Math.max(0, NOTEBOOK_PAGE_CANVAS.height - item.height), Math.max(0, item.y + dy)) });
  const resize = (factor: number) => {
    const bounded = Math.min(NOTEBOOK_PAGE_CANVAS.width / item.width, NOTEBOOK_PAGE_CANVAS.height / item.height,
      Math.max(8 / Math.min(item.width, item.height), factor));
    change({ ...item, width: item.width * bounded, height: item.height * bounded,
      ...(item.kind === "text" ? { size: Math.max(12, Math.min(160, item.size * bounded)) } : {}) });
  };
  return <View style={{ gap: space.sm }}>
    <AppText variant="caption">{b("selection")}</AppText>
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
      <Chip label={t("left")} onPress={() => move(-64, 0)} />
      <Chip label={t("right")} onPress={() => move(64, 0)} />
      <Chip label={t("up")} onPress={() => move(0, -64)} />
      <Chip label={t("down")} onPress={() => move(0, 64)} />
      <Chip label={b("larger")} onPress={() => resize(1.15)} />
      <Chip label={b("smaller")} onPress={() => resize(1/1.15)} />
      <Chip label={b("rotate")} onPress={() => change({ ...item, rotation: item.rotation >= 165 ? -180 : item.rotation + 15 })} />
      <Chip label={b("remove")} onPress={remove}/>
    </View>
  </View>;
}
