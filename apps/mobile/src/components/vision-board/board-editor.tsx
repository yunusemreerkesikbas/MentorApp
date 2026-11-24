import { useRef, useState } from "react";
import { Pressable } from "react-native";
import { createImageItem, createStickerItem, createTextItem } from "@mentor/core/board-document";
import { templateSlots, type BoardTemplateId } from "@mentor/core/board-templates";
import { LayerStyles } from "./layer-styles.js";
import { visionBoardDocSchema } from "@mentor/validation";
import { VISION_BOARD_CANVAS, type VisionBoardDoc, type VisionBoardItem, type VisionDto } from "@mentor/types";
import { AppText, Button, Chip, TextField } from "../ui/index.js";
import { useTranslations } from "../../providers/i18n-provider.js";
import { useThemeTokens } from "../../providers/theme-provider.js";
import { useAppAvailability } from "../../providers/availability-provider.js";
import { newRequestId } from "../../lib/request-id.js";
import { pickDevicePhoto } from "../../lib/device-photo.js";
import { uploadPicture } from "../../lib/vision-board-api.js";
import { changeBoardItem, boardErrorKey } from "../../lib/vision-board-view.js";
import { BoardStage } from "./board-stage.js";
import { BoardChoices } from "./board-choices.js";
import { BoardShare } from "./board-share.js";
import { Wrap } from "./screen.js";
import { useBoardDraft } from "./use-board-draft.js";

export function BoardEditor({ vision }: { vision: VisionDto }) {
  const { availability } = useAppAvailability();
  const t = useTranslations("visionBoard");
  const { palette, radii, space, touchTargets } = useThemeTokens();
  const [busy, setBusy] = useState(false);
  const [sharing, setSharing] = useState(false);
  const { doc, edit, dirty, error, saving, save } = useBoardDraft(vision, busy, sharing);
  const [showLayers, setShowLayers] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [text, setText] = useState("");
  const uploading = useRef(false);
  const [issue, setIssue] = useState("");
  const [template, setTemplate] = useState<BoardTemplateId | null>(null);
  const layer = doc.items.find(i => i.id === selected);
  function select(id: string) {
    setSelected(id);
    const item = doc.items.find(i => i.id === id);
    setText(item?.kind === "text" ? item.text : "");
  }
  function insert(create: (d: VisionBoardDoc) => VisionBoardItem) {
    edit(draft => {
      const item = create(draft);
      const next = { ...draft, items: [...draft.items, item] };
      if (!visionBoardDocSchema.safeParse(next).success) {
        setIssue(t("limit"));
        return draft;
      }
      setSelected(item.id);
      setText(item.kind === "text" ? item.text : "");
      setIssue("");
      return next;
    });
  }
  async function photo(source: "camera" | "gallery") {
    if (uploading.current) return;
    uploading.current = true;
    setBusy(true);
    setIssue("");
    try {
      const file = await pickDevicePhoto(source);
      if (!file) return;
      const storageKey = await uploadPicture(file, "board");
      insert(d => {
        const slot = template && templateSlots(template)[d.items.filter(i => i.kind === "image").length];
        const ratio = file.width > 0 && file.height > 0
          ? Math.max(0.12, Math.min(12, file.width / file.height))
          : undefined;
        return { ...createImageItem(newRequestId(), storageKey, d.items, ratio), ...slot, url: file.uri };
      });
    } catch (err) {
      setIssue(t(boardErrorKey(err)));
    } finally {
      uploading.current = false;
      setBusy(false);
    }
  }
  function update(fn: (item: VisionBoardItem) => VisionBoardItem) {
    if (selected) edit(d => changeBoardItem(d, selected, fn));
  }
  function size(factor: number) {
    update(i => ({ ...i, width: Math.max(8, Math.min(5000, i.width * factor)), height: Math.max(8, Math.min(5000, i.height * factor)),
      ...(i.kind === "text" ? { size: Math.max(12, Math.min(160, i.size * factor)) } : {}) }));
  }
  if (sharing) return <BoardShare doc={doc} onClose={() => setSharing(false)} />;
  return <>
    <BoardStage doc={doc} selectedId={selected ?? undefined} onSelect={select}
      onMove={(id, x, y) => edit(d => changeBoardItem(d, id, i => ({ ...i, x, y })))} />
    <AppText tone={error ? "danger" : "secondary"} accessibilityLiveRegion="polite">
      {error ?? (dirty ? t("savePending") : doc.status === "PUBLISHED" ? t("published") : t("saved"))}
    </AppText>
    <Wrap>
      <Chip label={t("layers")} selected={showLayers} onPress={() => setShowLayers(current => !current)} />
      {showLayers && doc.items.map(item => (
        <Pressable key={item.id} accessibilityRole="button" accessibilityState={{ selected: selected === item.id }}
          onPress={() => select(item.id)} style={{
            justifyContent: "center", minHeight: touchTargets.min, borderRadius: radii.inner,
            paddingHorizontal: space.md, paddingVertical: space.sm,
            backgroundColor: selected === item.id ? palette.ctaPlayBg : palette.surfaceAlt,
          }}>
          <AppText tone={selected === item.id ? "ctaInk" : "main"}>
            {item.kind === "text" ? item.text : t(item.kind === "image" ? "photos" : "stickers")}
          </AppText>
        </Pressable>
      ))}
    </Wrap>
    <BoardChoices doc={doc} edit={edit} template={template} onTemplate={setTemplate}
      addSticker={asset => insert(d => createStickerItem(newRequestId(), asset, d.items))} />
    <TextField label={t("caption")} value={text} onChangeText={setText} maxLength={280} />
    <Wrap>
      <Chip label={t("addText")} onPress={() => { if (text.trim()) insert(d => createTextItem(newRequestId(), text.trim(), d.items)); }} />
      {layer?.kind === "text" && <Chip label={t("editText")} onPress={() => {
        if (text.trim()) update(i => i.kind === "text" ? { ...i, text: text.trim(), source: undefined } : i);
      }} />}
    </Wrap>
    {layer && <>
      <AppText variant="cardTitle">{t("selection")}</AppText>
      <Wrap>
        <Chip label={t("larger")} onPress={() => size(1.15)} /><Chip label={t("smaller")} onPress={() => size(1 / 1.15)} />
        <Chip label={t("rotate")} onPress={() => update(i => ({ ...i, rotation: ((i.rotation + 195) % 360) - 180 }))} />
        <Chip label={t("centerLayer")} onPress={() => update(item => ({
          ...item, x: (VISION_BOARD_CANVAS.width - item.width) / 2, y: (VISION_BOARD_CANVAS.height - item.height) / 2,
        }))} />
        <Chip label={t("front")} onPress={() => edit(d => ({ ...d, items: [...d.items.filter(i => i.id !== selected).sort((a,b) => a.z - b.z), layer].map((i,z) => ({ ...i,z })) }))} />
        <Chip label={t("remove")} onPress={() => { edit(d => ({ ...d, items: d.items.filter(i => i.id !== selected) })); setSelected(null); setText(""); }} />
      </Wrap>
      <LayerStyles item={layer} update={update} />
    </>}
    <Wrap><Chip label={t("gallery")} onPress={() => void photo("gallery")} /><Chip label={t("camera")} onPress={() => void photo("camera")} /></Wrap>
    {busy && <AppText>{t("loading")}</AppText>}{issue && <AppText tone="danger">{issue}</AppText>}
    <Button label={error ? t("retry") : t("save")} loading={saving} disabled={busy} onPress={() => void save()} />
    {doc.status !== "PUBLISHED" && <Button label={t("publishBoard")} variant="secondary" disabled={busy || saving}
      onPress={() => { edit(d => ({ ...d, status: "PUBLISHED" })); void save(); }} />}
    {availability.forum && <Button label={t("shareRoom")} variant="secondary" disabled={busy || saving} onPress={() => setSharing(true)} />}
  </>;
}
