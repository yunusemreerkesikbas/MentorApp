import { useEffect, useRef } from "react";
import { Animated, StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { useReducedMotion } from "react-native-reanimated";
import type { CareerGroup } from "@mentor/types";
import { PUHU_MOTION_FRAMES, careerPuhu3d } from "../../lib/onboarding-assets.js";

/** Fixed in both themes: the lamp-lit window from the welcome's last scene. */
const WINDOW = { frame: "#2C3D56", light: "#FFF3D1", lamp: "#FFD15C" } as const;
const SIZE = 176;

/**
 * The web's `ReadyWindow`: the lit window holding the Puhu of the field they picked (the default
 * pose without one). RN has no radial gradient, so a lamp ring around a light core stands in.
 */
export function ReadyWindow({ career }: { career: CareerGroup | null }) {
  const reduceMotion = useReducedMotion();
  const appear = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(appear, { toValue: 1, duration: reduceMotion ? 120 : 400, useNativeDriver: true }).start();
  }, [appear, reduceMotion]);

  const scale = reduceMotion ? 1 : appear.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] });

  return (
    <Animated.View accessible={false} style={[styles.root, { opacity: appear, transform: [{ scale }] }]}>
      <View style={styles.glow} />
      <View style={styles.window}>
        <View style={styles.core} />
        <Image source={career ? careerPuhu3d(career) : PUHU_MOTION_FRAMES.default} style={styles.puhu} contentFit="contain" />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { width: SIZE, height: SIZE, alignItems: "center", justifyContent: "center" },
  glow: { position: "absolute", width: SIZE + 72, height: SIZE + 72, borderRadius: (SIZE + 72) / 2, backgroundColor: WINDOW.lamp, opacity: 0.18 },
  window: { width: SIZE, height: SIZE, borderRadius: 16, borderWidth: 6, borderColor: WINDOW.frame, backgroundColor: WINDOW.lamp, overflow: "hidden", alignItems: "center", justifyContent: "center" },
  core: { position: "absolute", width: SIZE * 0.9, height: SIZE * 0.9, borderRadius: SIZE * 0.45, backgroundColor: WINDOW.light },
  puhu: { position: "absolute", top: 12, left: 12, right: 12, bottom: 12 },
});
