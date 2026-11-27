import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from "react-native-reanimated";
import { useThemeTokens } from "../../providers/theme-provider.js";

/** The web's 12dp progress pill: the fill grows from the previous step; no "Adım n / 7" text. */
export function PlayProgress({ done, total, label }: { done: number; total: number; label: string }) {
  const { palette } = useThemeTokens();
  const reduceMotion = useReducedMotion();
  const ratio = Math.min(1, Math.max(0, done / total));
  const width = useSharedValue(reduceMotion ? ratio : Math.max(done - 1, 0) / total);
  useEffect(() => {
    width.value = reduceMotion ? ratio : withTiming(ratio, { duration: 300 });
  }, [ratio, reduceMotion, width]);
  const fill = useAnimatedStyle(() => ({ width: `${width.value * 100}%` }));
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: total, now: done }}
      style={[styles.track, { backgroundColor: palette.playTrack }]}
    >
      <Animated.View style={[styles.fill, { backgroundColor: palette.ctaPlayBg }, fill]}>
        <View style={styles.shine} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  track: { height: 12, flex: 1, borderRadius: 999, overflow: "hidden" },
  fill: { height: "100%", borderRadius: 999 },
  shine: { position: "absolute", left: 8, right: 8, top: 3, height: 3, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.35)" },
});
