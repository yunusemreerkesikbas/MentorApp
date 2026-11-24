import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { Image } from "expo-image";
import { useVideoPlayer, VideoView } from "expo-video";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import type { WeeklyRecapCharacterKey } from "@mentor/core";
import { recapArt } from "../../lib/art.js";
import { clipDriftCheckDue } from "./recap-flow.js";

/**
 * A muted clip that follows the story clock: it plays while the story plays (and before `limitMs`),
 * seeks back when it drifts more than 0.25 s (checked once a second), and shows `fallback` if it
 * cannot play.
 */
export function RecapClip({
  source,
  elapsedMs,
  playing,
  limitMs = Number.POSITIVE_INFINITY,
  poster,
  fallback,
}: {
  source: number;
  elapsedMs: number;
  playing: boolean;
  limitMs?: number;
  /** Drawn under the clip until its first frame (a texture view stays clear until then). */
  poster?: ReactNode;
  fallback: ReactNode;
}) {
  const [durationMs, setDurationMs] = useState<number | null>(null);
  const player = useVideoPlayer(source, (created) => {
    created.muted = true;
  });
  const [status, setStatus] = useState(player.status);
  const failed = status === "error";

  useEffect(() => {
    // Re-read on subscribe: a source that fails before the listener attaches still falls back.
    setStatus(player.status);
    const subscription = player.addListener("statusChange", ({ status: next }) => setStatus(next));
    return () => subscription.remove();
  }, [player]);

  useEffect(() => {
    if (status === "readyToPlay" && player.duration > 0) setDurationMs(player.duration * 1000);
  }, [player, status]);

  const endMs = Math.min(limitMs, durationMs ?? Number.POSITIVE_INFINITY);
  const shouldPlay = playing && elapsedMs < endMs;

  const checkedAt = useRef<number | null>(null);
  useEffect(() => {
    // Like the web's `readyState === 0` guard: no seeking while the clip is still loading.
    if (status !== "readyToPlay" || !clipDriftCheckDue(elapsedMs, checkedAt.current)) return;
    checkedAt.current = elapsedMs;
    const expected = Math.min(elapsedMs, Number.isFinite(endMs) ? Math.max(0, endMs - 50) : elapsedMs) / 1000;
    if (Math.abs(player.currentTime - expected) > 0.25) player.currentTime = expected;
  }, [elapsedMs, endMs, status, player]);

  useEffect(() => {
    if (failed) return;
    if (shouldPlay) player.play();
    else player.pause();
  }, [failed, player, shouldPlay]);

  if (failed) return <>{fallback}</>;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {poster}
      <VideoView
        player={player}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        nativeControls={false}
        surfaceType="textureView"
      />
    </View>
  );
}

/** The lakap's character clip, its still under it and as the fallback, with the web's dark fade. */
export function RecapCharacterVideo({
  character,
  elapsedMs,
  playing,
}: {
  character: WeeklyRecapCharacterKey;
  elapsedMs: number;
  playing: boolean;
}) {
  const art = recapArt.characters[character];
  const still = <Image source={art.still} style={StyleSheet.absoluteFill} contentFit="cover" />;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <RecapClip source={art.video} elapsedMs={elapsedMs} playing={playing} poster={still} fallback={still} />
      <Shade
        style={StyleSheet.absoluteFill}
        stops={[
          [0, 0.15],
          [0.5, 0],
          [1, 0.45],
        ]}
      />
    </View>
  );
}

/** A vertical black fade: `[offset, opacity]` stops, top to bottom. */
export function Shade({
  stops,
  style,
}: {
  stops: [offset: number, opacity: number][];
  style: StyleProp<ViewStyle>;
}) {
  const id = `shade${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  return (
    <View pointerEvents="none" style={style}>
      <Svg width="100%" height="100%" preserveAspectRatio="none" viewBox="0 0 1 1">
        <Defs>
          <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            {stops.map(([offset, opacity]) => (
              <Stop key={offset} offset={offset} stopColor="#000000" stopOpacity={opacity} />
            ))}
          </LinearGradient>
        </Defs>
        <Rect width="1" height="1" fill={`url(#${id})`} />
      </Svg>
    </View>
  );
}
