import { useRef, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View, type GestureResponderEvent } from "react-native";
import { Image } from "expo-image";
import Svg, { Circle, Defs, Path, Pattern, Polyline, Rect } from "react-native-svg";
import { lightThemeTokens } from "@mentor/ui/tokens";
import { NOTEBOOK_PAGE_CANVAS, type NotebookEntryDto, type NotebookInkStroke, type NotebookPageDoc } from "@mentor/types";
import { NOTEBOOK_INK_MAX_POINTS } from "@mentor/validation";
import { useAuth } from "../../providers/auth-provider.js";
import { newRequestId } from "../../lib/request-id.js";
import { strokeCoordinates } from "../../lib/notebooks-view.js";
import { useTranslations } from "../../providers/i18n-provider.js";
import { useThemeTokens } from "../../providers/theme-provider.js";
import { BoardItemArt, boardAssetSource } from "../vision-board/board-item.js";
import { Button } from "../ui/index.js";

export function NotebookLightbox({ uri, close }: { uri: string; close: () => void }) {
  const { mediaImageSource } = useAuth();
  const t = useTranslations("notebooks");
  const { palette, space } = useThemeTokens();
  return <Modal visible onRequestClose={close} animationType="fade">
    <View style={{ flex: 1, padding: space.xl, backgroundColor: palette.bg, justifyContent: "center" }}>
      <Image cachePolicy="none" source={mediaImageSource(uri)} contentFit="contain" style={{ flex: 0.8 }} />
      <Button label={t("close")} onPress={close} />
    </View>
  </Modal>;
}

export function NotebookCanvas({ doc, entries, drawing, onStroke, onSelect, selected }: {
  doc: NotebookPageDoc; entries: NotebookEntryDto[]; drawing: boolean; onStroke: (stroke: NotebookInkStroke) => void; selected: string | null; onSelect: (id: string) => void;
}) {
  const { mediaImageSource } = useAuth();
  const t = useTranslations("notebooks");
  const a = useTranslations("analysis");
  const [width, setWidth] = useState(0);
  const [photo, setPhoto] = useState<string | null>(null);
  const [preview, setPreview] = useState<number[]>([]);
  const points = useRef<number[]>([]);
  const canvas = NOTEBOOK_PAGE_CANVAS;
  const scale = width / canvas.width;
  const ink = lightThemeTokens.main;
  const sample = (event: GestureResponderEvent) => {
    if (!scale || points.current.length >= NOTEBOOK_INK_MAX_POINTS * 3) return;
    const { locationX, locationY } = event.nativeEvent;
    points.current.push(Math.max(0, Math.min(canvas.width, locationX / scale)), Math.max(0, Math.min(canvas.height, locationY / scale)), 0.5);
    setPreview([...points.current]);
  };
  const finish = () => {
    if (points.current.length >= 6) onStroke({ id: newRequestId(), tool: "pen", size: 6, color: ink, opacity: 1, points: points.current });
    points.current = []; setPreview([]);
  };
  return <View onLayout={e => setWidth(e.nativeEvent.layout.width)} style={{ aspectRatio: canvas.width / canvas.height, overflow: "hidden", backgroundColor: lightThemeTokens.surface }}>
    <Svg width="100%" height="100%" viewBox={`0 0 ${canvas.width} ${canvas.height}`} style={StyleSheet.absoluteFill}>
      <Defs><Pattern id="lines" width={56} height={56} patternUnits="userSpaceOnUse">
        {doc.paper === "dotted" ? <Circle cx={4} cy={4} r={3} fill={lightThemeTokens.border} /> :
          <Path d={doc.paper === "grid" ? "M0 56V0H56" : "M0 0H56"} stroke={lightThemeTokens.border} strokeWidth={2}/>}
      </Pattern></Defs>{doc.paper !== "plain" && <Rect width="100%" height="100%" fill="url(#lines)" />}
    </Svg>
    {width > 0 && [...doc.items].sort((a,b) => a.z-b.z).map(item => {
      const entry = item.kind === "entry" ? entries.find(e => e.id === item.entryId) : undefined;
      const raw = item.kind === "image" ? item.url : entry?.url;
      const uri = raw ?? null;
      return <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={uri ? t("photo") : undefined}
        disabled={drawing} onPress={() => { onSelect(item.id); if (uri) setPhoto(uri); }}
        style={{ position: "absolute", left: item.x * scale, top: item.y * scale, width: item.width * scale,
          height: item.height * scale, borderWidth: selected === item.id ? 1 : 0, borderColor: lightThemeTokens.ctaPlayEdge, opacity: item.opacity, transform: [{ rotate: item.rotation + "deg" }] }}>
        {uri ? <Image cachePolicy="none" source={mediaImageSource(uri)} contentFit="contain" style={{ flex: 1 }} /> : item.kind === "text" || item.kind === "sticker" ?
          <BoardItemArt item={item} scale={scale} source={item.kind === "sticker" ? boardAssetSource(item) : undefined} /> :
          <Text style={{ color: ink }}>{entry?.note ?? (entry ? a(`error_${entry.errorType}`) : "")}</Text>}
      </Pressable>;
    })}
    <View pointerEvents={drawing ? "auto" : "none"} style={StyleSheet.absoluteFill}
      onStartShouldSetResponder={() => drawing} onResponderTerminationRequest={() => false}
      onResponderGrant={e => { points.current = []; sample(e); }} onResponderMove={sample}
      onResponderRelease={finish} onResponderTerminate={finish}>
      <Svg pointerEvents="none" width="100%" height="100%" viewBox={`0 0 ${canvas.width} ${canvas.height}`}>
        {(doc.ink ?? []).map(s => <Polyline key={s.id} points={strokeCoordinates(s.points)} fill="none" stroke={s.color} strokeWidth={s.size} opacity={s.opacity} strokeLinecap="round" strokeLinejoin="round" />)}
        {preview.length > 0 && <Polyline points={strokeCoordinates(preview)} fill="none" stroke={ink} strokeWidth={6} strokeLinecap="round" />}
      </Svg>
    </View>
    {photo && <NotebookLightbox uri={photo} close={() => setPhoto(null)} />}
  </View>;
}
