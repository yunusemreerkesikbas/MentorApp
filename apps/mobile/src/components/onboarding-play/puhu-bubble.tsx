import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { useReducedMotion } from "react-native-reanimated";
import { PUHU_MOTION_FRAMES, type PuhuPose } from "../../lib/onboarding-assets.js";
import { useThemeTokens } from "../../providers/theme-provider.js";
import { AppText } from "../ui/index.js";

/**
 * The web's `PuhuBubble`: Puhu asks the question. The mouth moves for a moment when the words
 * change, then one blink; reduced motion keeps the resting pose. `pose` replaces the rest frame.
 */
export function PuhuBubble({ title, sub, pose = "default" }: { title: string; sub?: string; pose?: PuhuPose }) {
  const { palette, radii, space } = useThemeTokens();
  const reduceMotion = useReducedMotion();
  const [frame, setFrame] = useState<PuhuPose>(pose);

  useEffect(() => {
    if (reduceMotion) {
      setFrame(pose);
      return;
    }
    let closed = false;
    const mouth = setInterval(() => {
      closed = !closed;
      setFrame(closed ? "talkClosed" : pose);
    }, 150);
    const stop = setTimeout(() => {
      clearInterval(mouth);
      setFrame("blink");
    }, 900);
    const open = setTimeout(() => setFrame(pose), 1_060);
    return () => {
      clearInterval(mouth);
      clearTimeout(stop);
      clearTimeout(open);
    };
  }, [title, sub, pose, reduceMotion]);

  return (
    <View style={styles.row}>
      <Image source={PUHU_MOTION_FRAMES[frame]} style={styles.puhu} contentFit="contain" accessible={false} />
      <View
        accessibilityLiveRegion="polite"
        style={[styles.bubble, { borderColor: palette.playLine, backgroundColor: palette.surface, borderRadius: radii.button, padding: space.md }]}
      >
        <View style={[styles.tail, { borderColor: palette.playLine, backgroundColor: palette.surface }]} />
        <AppText accessibilityRole="header" style={styles.title}>{title}</AppText>
        {sub ? <AppText tone="secondary" style={styles.sub}>{sub}</AppText> : null}
      </View>
    </View>
  );
}

/** Question without Puhu, for screens whose cards already carry one (field, daily goal). */
export function PlayTitle({ title, sub, center = false }: { title: string; sub?: string; center?: boolean }) {
  return (
    <View style={styles.titleBlock}>
      <AppText accessibilityRole="header" style={[styles.bigTitle, center && styles.center]}>{title}</AppText>
      {sub ? <AppText tone="secondary" style={[styles.bigSub, center && styles.center]}>{sub}</AppText> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  puhu: { width: 88, height: 88 },
  bubble: { flex: 1, minWidth: 0, borderWidth: 2 },
  tail: {
    position: "absolute", left: -9, top: "50%", width: 14, height: 14, marginTop: -7,
    borderLeftWidth: 2, borderBottomWidth: 2, transform: [{ rotate: "45deg" }],
  },
  title: { fontSize: 20, lineHeight: 26, fontWeight: "800" },
  sub: { marginTop: 4, fontSize: 14, lineHeight: 20, fontWeight: "500" },
  titleBlock: { gap: 6 },
  bigTitle: { fontSize: 24, lineHeight: 30, fontWeight: "800" },
  bigSub: { fontSize: 16, lineHeight: 24, fontWeight: "500" },
  center: { textAlign: "center" },
});
