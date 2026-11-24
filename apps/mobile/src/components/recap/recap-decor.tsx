import { useEffect } from "react";
import { StyleSheet, View, type ViewStyle } from "react-native";
import { Image } from "expo-image";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import type { WeeklyRecapSlideKind } from "@mentor/core";
import { recapArt, type RecapDecorKey } from "../../lib/art.js";

/** How far each shape drifts and back, and how long one round takes (the web's `STORY_ASSET_DRIFT`). */
const DRIFT: Record<RecapDecorKey, { x: number; y: number; rotate: number; duration: number }> = {
  floral: { x: 10, y: -14, rotate: 3, duration: 8.4 },
  graphics: { x: -12, y: 10, rotate: -4, duration: 7.8 },
  greenShape: { x: 14, y: 8, rotate: 3, duration: 9.2 },
  greenWiggle: { x: -8, y: -16, rotate: -2, duration: 8.8 },
  lavenderPixel: { x: 12, y: -8, rotate: 2, duration: 7.6 },
  lavenderShape: { x: -10, y: 14, rotate: -3, duration: 9.4 },
  redPixel: { x: 8, y: 12, rotate: 2, duration: 8.2 },
  silverWiggle: { x: -14, y: 10, rotate: -2, duration: 10 },
  worldMap: { x: 8, y: -10, rotate: 2, duration: 9.6 },
};

interface Spot {
  src: RecapDecorKey;
  /** The web's Tailwind box, as percentages of the slide. */
  box: ViewStyle;
  rotate?: number;
  delay?: number;
  opacity?: number;
}

const square = (width: `${number}%`): ViewStyle => ({ width, aspectRatio: 1 });

/** The web's `StoryDecor` layouts (weekly-recap-story.tsx), slide by slide. */
const LAYOUT: Partial<Record<WeeklyRecapSlideKind, Spot[]>> = {
  welcome: [
    { src: "floral", box: { left: "-22%", top: "-8%", ...square("74%") } },
    { src: "lavenderShape", box: { right: "-18%", top: "-2%", ...square("58%") }, rotate: 90, delay: 0.08 },
    { src: "silverWiggle", box: { bottom: "-24%", left: "-42%", height: "72%", width: "92%" }, rotate: 30, delay: 0.16 },
    { src: "redPixel", box: { bottom: "-5%", right: "-12%", ...square("58%") }, delay: 0.24 },
  ],
  week_map: [
    { src: "greenShape", box: { bottom: "-12%", left: "-18%", ...square("44%") }, delay: 0.18 },
    { src: "floral", box: { bottom: "-12%", right: "-18%", ...square("42%") }, delay: 0.24 },
  ],
  focus: [
    { src: "greenShape", box: { bottom: "-12%", left: "-24%", ...square("62%") } },
    { src: "greenWiggle", box: { bottom: "-18%", right: "-15%", height: "54%", width: "52%" }, rotate: 180, delay: 0.18 },
    { src: "worldMap", box: { bottom: "7%", left: "18%", width: "64%", height: "64%" }, delay: 0.24, opacity: 0.85 },
  ],
  weekly_run: [
    { src: "lavenderShape", box: { left: "-9%", top: "-7%", ...square("48%") } },
    { src: "floral", box: { right: "-18%", top: "-8%", ...square("58%") }, delay: 0.08 },
    { src: "silverWiggle", box: { bottom: "-34%", left: "-48%", height: "72%", width: "98%" }, rotate: 52, delay: 0.16 },
    { src: "lavenderPixel", box: { bottom: "-2%", right: "-24%", height: "32%", width: "72%" }, rotate: -12, delay: 0.22 },
  ],
  weekly_best: [
    { src: "greenShape", box: { left: "-14%", top: "-8%", ...square("58%") } },
    { src: "silverWiggle", box: { right: "-50%", top: "-32%", height: "76%", width: "105%" }, rotate: 145, delay: 0.08 },
    { src: "graphics", box: { bottom: "-5%", left: "-20%", ...square("54%") }, delay: 0.16 },
    { src: "lavenderShape", box: { bottom: "-12%", right: "-12%", ...square("44%") }, rotate: 180, delay: 0.22 },
  ],
  performance: [
    { src: "greenWiggle", box: { left: "-18%", top: "-18%", height: "50%", width: "48%" }, rotate: 180 },
    { src: "greenShape", box: { right: "-22%", top: "-12%", ...square("62%") }, rotate: -22, delay: 0.08 },
    { src: "floral", box: { bottom: "-2%", left: "-26%", ...square("60%") }, delay: 0.16 },
    { src: "graphics", box: { bottom: "-10%", right: "-22%", ...square("58%") }, rotate: -110, delay: 0.24 },
  ],
  weekly_title: [
    { src: "silverWiggle", box: { left: "-42%", top: "-20%", height: "64%", width: "92%" }, rotate: 32 },
    { src: "greenWiggle", box: { right: "-4%", top: "-10%", height: "44%", width: "42%" }, rotate: 180, delay: 0.08 },
    { src: "redPixel", box: { right: "-2%", top: "2%", ...square("32%") }, delay: 0.13 },
    { src: "graphics", box: { bottom: "-10%", left: "-20%", ...square("50%") }, delay: 0.18 },
    { src: "floral", box: { bottom: "-8%", right: "-20%", ...square("52%") }, delay: 0.24 },
  ],
  final: [
    { src: "lavenderShape", box: { left: "-22%", top: "-12%", ...square("62%") } },
    { src: "silverWiggle", box: { right: "-26%", top: "-18%", height: "48%", width: "62%" }, rotate: 40, delay: 0.08 },
    { src: "greenWiggle", box: { bottom: "-14%", left: "-24%", height: "42%", width: "52%" }, rotate: 180, delay: 0.16 },
    { src: "floral", box: { bottom: "-12%", right: "-22%", ...square("54%") }, delay: 0.24 },
  ],
};

/** The slide's drifting shapes; still under reduced motion. */
export function RecapDecor({ kind, reducedMotion }: { kind: WeeklyRecapSlideKind; reducedMotion: boolean }) {
  const spots = LAYOUT[kind];
  if (!spots) return null;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {spots.map((spot) => (
        <DecorAsset key={`${spot.src}-${spot.delay ?? 0}`} spot={spot} reducedMotion={reducedMotion} />
      ))}
    </View>
  );
}

function DecorAsset({ spot, reducedMotion }: { spot: Spot; reducedMotion: boolean }) {
  const drift = DRIFT[spot.src];
  const wave = useSharedValue(0);
  const shown = useSharedValue(reducedMotion ? 1 : 0);

  useEffect(() => {
    if (reducedMotion) {
      shown.value = 1;
      return;
    }
    const delay = (spot.delay ?? 0) * 1000;
    const half = drift.duration * 500;
    const ease = Easing.inOut(Easing.ease);
    shown.value = withDelay(delay, withTiming(1, { duration: 500 }));
    wave.value = withDelay(
      delay,
      withRepeat(
        withSequence(withTiming(1, { duration: half, easing: ease }), withTiming(0, { duration: half, easing: ease })),
        -1,
      ),
    );
    return () => {
      cancelAnimation(wave);
      cancelAnimation(shown);
    };
  }, [drift.duration, reducedMotion, shown, spot.delay, wave]);

  const animated = useAnimatedStyle(() => ({
    opacity: shown.value,
    transform: [
      { translateX: drift.x * wave.value },
      { translateY: drift.y * wave.value },
      { rotate: `${drift.rotate * wave.value}deg` },
      // Grows in from 92 %, then breathes by 2.5 %.
      { scale: 0.92 + 0.08 * shown.value + 0.025 * wave.value },
    ],
  }));

  return (
    <View
      style={[
        styles.spot,
        spot.box,
        { opacity: spot.opacity ?? 1 },
        spot.rotate ? { transform: [{ rotate: `${spot.rotate}deg` }] } : null,
      ]}
    >
      <Animated.View style={[styles.fill, animated]}>
        <Image source={recapArt.decor[spot.src]} style={styles.fill} contentFit="contain" />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  spot: {
    position: "absolute",
  },
  fill: {
    width: "100%",
    height: "100%",
  },
});
