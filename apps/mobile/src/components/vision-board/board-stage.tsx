import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, PanResponder, StyleSheet, View } from "react-native";
import { VISION_BOARD_CANVAS, type VisionBoardDoc, type VisionBoardItem } from "@mentor/types";
import { STICKER_ART } from "@mentor/core/board-stickers";
import { useAuth } from "../../providers/auth-provider.js";
import { useTranslations } from "../../providers/i18n-provider.js";
import { useThemeTokens } from "../../providers/theme-provider.js";
import { BoardItemArt, boardAssetSource, type BoardAssetStatus } from "./board-item.js";
import { BoardSurface, WoodMoulding, boardFrames } from "./board-surface.js";

export type BoardStageStatus = BoardAssetStatus | "loading";

type MoveItem = (id: string, x: number, y: number) => void;
type SelectItem = (id: string) => void;
const COORD_LIMIT = 5_000;
const TOUCH_SLOP = 3;

function boardCoordinate(value: number) {
  return Math.round(Math.max(-COORD_LIMIT, Math.min(COORD_LIMIT, value)));
}

function StageItem({ item, scale, selected, onSelect, onMove, reportAssetStatus }: {
  item: VisionBoardItem;
  scale: number;
  selected: boolean;
  onSelect?: SelectItem;
  onMove?: MoveItem;
  reportAssetStatus: (key: string, status: BoardAssetStatus) => void;
}) {
  const { mediaImageSource } = useAuth();
  const { palette } = useThemeTokens();
  const t = useTranslations("visionBoard");
  const [offset] = useState(() => new Animated.ValueXY());
  const gestureRef = useRef<{ x: number; y: number } | null>(null);
  const handlers = useRef({ onSelect, onMove, item, scale });
  useEffect(() => { handlers.current = { onSelect, onMove, item, scale }; },
    [onSelect, onMove, item, scale]);
  const gesture = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => Boolean(handlers.current.onSelect || handlers.current.onMove),
    onPanResponderGrant: () => {
      const current = handlers.current;
      gestureRef.current = { x: current.item.x, y: current.item.y };
      current.onSelect?.(current.item.id);
    },
    onPanResponderMove: (_, { dx, dy }) => {
      if (handlers.current.onMove) offset.setValue({ x: dx, y: dy });
    },
    onPanResponderRelease: (_, { dx, dy }) => {
      const current = handlers.current;
      const start = gestureRef.current;
      if (start && Math.hypot(dx, dy) >= TOUCH_SLOP) {
        current.onMove?.(current.item.id, boardCoordinate(start.x + dx / current.scale),
          boardCoordinate(start.y + dy / current.scale));
      }
      gestureRef.current = null;
      offset.setValue({ x: 0, y: 0 });
    },
    onPanResponderTerminationRequest: () => false,
    onPanResponderTerminate: () => {
      gestureRef.current = null;
      offset.setValue({ x: 0, y: 0 });
    },
  }), [offset]);

  const source = item.kind === "image" ? mediaImageSource(item.url) : boardAssetSource(item);
  const key = assetKey(item);
  useEffect(() => {
    if (key && !source) reportAssetStatus(key, "unavailable");
  }, [key, source, reportAssetStatus]);
  const interactive = Boolean(onSelect || onMove);
  const label = item.kind === "text" ? item.text : t(item.kind === "image" ? "photos" : "stickers");

  return <Animated.View pointerEvents={interactive ? "auto" : "none"}
    accessible={interactive} accessibilityRole={interactive ? "button" : undefined}
    accessibilityLabel={interactive ? label : undefined}
    accessibilityState={interactive ? { selected } : undefined}
    onAccessibilityTap={onSelect ? () => onSelect(item.id) : undefined}
    {...(interactive ? gesture.panHandlers : {})}
    style={{
      position: "absolute", left: item.x * scale, top: item.y * scale,
      width: item.width * scale, height: item.height * scale, opacity: item.opacity,
      transform: [{ translateX: offset.x }, { translateY: offset.y }, { rotate: `${item.rotation}deg` }],
    }}>
    <BoardItemArt key={key ?? item.id} item={item} scale={scale} source={source}
      onAssetStatus={key ? status => reportAssetStatus(key, status) : undefined} />
    {interactive && selected && <View pointerEvents="none" style={[StyleSheet.absoluteFill, {
      borderWidth: 2, borderColor: palette.accent,
    }]} />}
  </Animated.View>;
}

function assetKey(item: VisionBoardItem): string | null {
  if (item.kind === "image") return `${item.id}:${item.url ?? item.storageKey}`;
  if (item.kind === "sticker" && STICKER_ART[item.asset].kind === "image") return `${item.id}:${item.asset}`;
  return null;
}

export function BoardStage({ doc, selectedId, onSelect, onMove, onStatusChange }: {
  doc: VisionBoardDoc;
  selectedId?: string | null;
  onSelect?: SelectItem;
  onMove?: MoveItem;
  onStatusChange?: (status: BoardStageStatus) => void;
}) {
  const [width, setWidth] = useState(0);
  const [assets, setAssets] = useState<Record<string, BoardAssetStatus>>({});
  const ordered = useMemo(() => [...doc.items].sort((a, b) => a.z - b.z), [doc.items]);
  const frame = boardFrames[doc.frame];
  const inset = width * (frame.border + frame.mat);
  const boardWidth = width - 2 * inset;
  const boardHeight = boardWidth * VISION_BOARD_CANVAS.height / VISION_BOARD_CANVAS.width;
  const scale = boardWidth / VISION_BOARD_CANVAS.width;
  const assetStates = ordered.map(assetKey).filter(key => key !== null).map(key => assets[key]);
  const status = assetStates.includes("unavailable") ? "unavailable"
    : width > 0 && assetStates.every(state => state === "ready") ? "ready" : "loading";

  useEffect(() => { onStatusChange?.(status); }, [status, onStatusChange]);
  const [reportAssetStatus] = useState(() => (key: string, next: BoardAssetStatus) => {
    setAssets(previous => previous[key] === next ? previous : { ...previous, [key]: next });
  });

  return <View onLayout={event => setWidth(event.nativeEvent.layout.width)} style={{
    width: "100%", aspectRatio: 1 / ((1 - 2 * (frame.border + frame.mat)) *
      VISION_BOARD_CANVAS.height / VISION_BOARD_CANVAS.width + 2 * (frame.border + frame.mat)),
    borderRadius: width * frame.radius, backgroundColor: frame.rim,
  }}>
    {width > 0 && <>
      {doc.frame === "wood" && <WoodMoulding radius={width * frame.radius} />}
      <View style={{
        position: "absolute", top: width * frame.border, bottom: width * frame.border,
        left: width * frame.border, right: width * frame.border, backgroundColor: frame.matColor,
      }} />
      <View style={{
        position: "absolute", left: inset, top: inset, width: boardWidth, height: boardHeight,
        overflow: "hidden",
      }}>
        <BoardSurface background={doc.background} />
        {ordered.map(item => <StageItem key={item.id} item={item} scale={scale}
          selected={item.id === selectedId} onSelect={onSelect} onMove={onMove}
          reportAssetStatus={reportAssetStatus} />)}
      </View>
    </>}
  </View>;
}
