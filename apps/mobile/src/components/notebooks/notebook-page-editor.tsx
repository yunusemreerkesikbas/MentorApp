import { useCallback, useState } from "react";
import { Alert, BackHandler, View } from "react-native";
import { useFocusEffect, usePreventRemove } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { NOTEBOOK_PAPERS, type NotebookEntryDto, type NotebookPageDoc, type NotebookSummaryDto } from "@mentor/types";
import { NOTEBOOK_INK_MAX_TOTAL_POINTS, NOTEBOOK_PAGE_MAX_ITEMS, NOTEBOOK_PAGE_MAX_STROKES, notebookPageDocSchema } from "@mentor/validation";
import { lightThemeTokens } from "@mentor/ui/tokens";

import { getPage, putPage, uploadPagePhoto } from "../../lib/notebook-api.js";
import { appendStroke, itemPlacement, newWriting, replacePageItem } from "../../lib/notebooks-view.js";
import { newRequestId } from "../../lib/request-id.js";
import { useTranslations } from "../../providers/i18n-provider.js";
import { useThemeTokens } from "../../providers/theme-provider.js";
import { AppText, Button, Chip, Skeleton, TextField } from "../ui/index.js";
import { NotebookLayerTools } from "./notebook-layer-tools.js";
import { NotebookCanvas } from "./notebook-canvas.js";
import { NotebookError, NotebookFrame } from "./notebook-frame.js";

type Props = { book: NotebookSummaryDto; page: number; close: () => void };
export function NotebookPageEditor(props: Props) {
  const page = useQuery({ queryKey: ["notebook", props.book.id, "page", props.page], queryFn: () => getPage(props.page, props.book.id) });
  const t = useTranslations("notebooks");
  return page.data ? <Editor {...props} initial={page.data.doc} entries={page.data.entries} /> :
    <NotebookFrame title={t("page", { n: props.page + 1 })} onBack={props.close}>
      {page.isError ? <NotebookError retry={() => void page.refetch()} /> : <Skeleton height={260} />}
    </NotebookFrame>;
}
function Editor({ book, page, close, initial, entries }: Props & { initial: NotebookPageDoc; entries: NotebookEntryDto[] }) {
  const t = useTranslations("notebooks");

  const { space } = useThemeTokens();
  const client = useQueryClient();

  const [original] = useState(initial);
  const [doc, setDoc] = useState(initial);

  const [selected, setSelected] = useState<string | null>(null);
  const [drawing, setDrawing] = useState(false);

  const selectedItem = doc.items.find(i => i.id === selected);
  const canAdd = doc.items.length < NOTEBOOK_PAGE_MAX_ITEMS;
  const canPhoto = book.limits?.photoUploadEnabled !== false && canAdd;
  const valid = notebookPageDocSchema.safeParse(doc).success;
  const dirty = doc !== original;
  const upload = useMutation({
    mutationFn: uploadPagePhoto,
    onSuccess: image => {
      if (!image) return;
      const layerId = newRequestId();
      setSelected(layerId);
      setDoc(old => {
        const base = itemPlacement(old, layerId);
        const aspect = image.width > 0 && image.height > 0
          ? Math.max(0.05, Math.min(20, image.width / image.height))
          : 1;
        const height = Math.max(8, Math.min(base.height, base.width / aspect));
        return { ...old, items: [...old.items, { ...base, width: Math.max(8, height * aspect), height,
          kind: "image", storageKey: image.key, frame: "none", url: image.uri }] };
      });
    },
  });
  const save = useMutation({ mutationFn: () => putPage(page, notebookPageDocSchema.parse(doc), book.id), onSuccess: async data => {
    client.setQueryData(["notebook", book.id, "page", page], data);
    await client.invalidateQueries({ queryKey: ["notebook"] });
    close();
  } });
  const busy = upload.isPending || save.isPending;
  const leave = useCallback((go: () => void) => {
    if (busy) return;
    if (!dirty) { go(); return; }
    Alert.alert(t("pending"), undefined, [
      { text: t("stay"), style: "cancel" },
      { text: t("discard"), style: "destructive", onPress: go },
    ]);
  }, [busy, dirty, t]);
  const closePage = useCallback(() => leave(close), [leave, close]);
  useFocusEffect(useCallback(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      closePage();
      return true;
    });
    return () => subscription.remove();
  }, [closePage]));
  usePreventRemove(dirty || busy, ({ repeat }) => leave(repeat));
  return <NotebookFrame title={t("page", { n: page + 1 })} onBack={closePage} scroll={!drawing}>
    <NotebookCanvas doc={doc} entries={entries} drawing={drawing && !busy} selected={selected} onSelect={setSelected}
      onStroke={stroke => setDoc(old => appendStroke(old, stroke, NOTEBOOK_PAGE_MAX_STROKES, NOTEBOOK_INK_MAX_TOTAL_POINTS))} />
    <View style={{ gap: space.sm }}>
      <Button label={t(drawing ? "done" : "draw")} variant="secondary" disabled={busy || (!drawing && doc.ink.length >= NOTEBOOK_PAGE_MAX_STROKES)} onPress={() => setDrawing(!drawing)} />
      {!!doc.ink.length && <Button label={t("undo")} variant="secondary" disabled={busy} onPress={() => setDoc({ ...doc, ink: doc.ink.slice(0,-1) })} />}
      {selectedItem?.kind === "text" &&
        <TextField multiline maxLength={280} editable={!busy} label={t("writing")} value={selectedItem.text}
          onChangeText={text => setDoc(replacePageItem(doc, { ...selectedItem, text }))} />}
      {selectedItem && !busy && <NotebookLayerTools item={selectedItem} change={item => setDoc(replacePageItem(doc, item))}
        remove={() => { setDoc({ ...doc, items: doc.items.filter(i => i.id !== selected) }); setSelected(null); }} />}
      <Button label={t("write")} variant="secondary" disabled={!canAdd || busy} onPress={() => {
        const item = newWriting(doc, newRequestId(), lightThemeTokens.main);
        setDoc({ ...doc, items: [...doc.items, item] }); setSelected(item.id); setDrawing(false);
      }} />
      {canPhoto && (["camera", "gallery"] as const).map(source => <Button key={source} label={t(source)} variant="secondary" disabled={busy} onPress={() => upload.mutate(source)} />)}
      <AppText variant="caption">{t("paper")}</AppText>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>{NOTEBOOK_PAPERS.map(paper =>
        <Chip key={paper} label={t(paper)} selected={paper === doc.paper} onPress={busy ? undefined : () => setDoc({ ...doc, paper })} />)}</View>
      {upload.isError && <AppText tone="danger">{t("imageError")}</AppText>}
      {save.isError && <AppText tone="danger">{save.error.message || t("error")}</AppText>}
      <Button label={t("save")} disabled={!dirty || !valid || busy} loading={save.isPending} onPress={() => save.mutate()} />
    </View>
  </NotebookFrame>;
}
