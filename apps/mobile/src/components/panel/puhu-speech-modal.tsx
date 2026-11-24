import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import { Image } from "expo-image";
import { useReducedMotion } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import { CloseCircleIcon } from "@solar-icons/react-native/linear/close-circle";
import { puhuSpeakingArt } from "../../lib/art.js";
import { useIsPremium } from "../../lib/premium.js";
import { useTranslations } from "../../providers/i18n-provider.js";
import { useThemeTokens } from "../../providers/theme-provider.js";
import { AppText } from "../ui/text.js";
import { LedgeButton } from "./primitives.js";

/** The web's cloud outline (`puhu-thought-cloud.tsx`), stretched to whatever the words need. */
const CLOUD =
  "M 48 76 C 24 36 76 8 120 26 C 151 -4 202 -2 228 24 C 276 0 330 18 338 56 C 384 54 408 98 384 132 C 410 166 390 210 352 216 C 350 258 294 278 252 258 C 218 282 158 282 130 258 C 84 276 36 252 40 216 C 0 208 -8 162 18 140 C -4 108 10 80 48 76 Z";
const EASE = Easing.bezier(0.22, 1, 0.36, 1);
const CHAR_MS = 22;

/**
 * Puhu answers in a thought cloud (the web's `PuhuSpeechModal`, phone layout): he appears, the
 * thought rises from him as two dots, the cloud opens and the words are spoken into it.
 */
export function PuhuSpeechModal({
  visible,
  text,
  loading,
  onClose,
}: {
  visible: boolean;
  text: string | null;
  /** Puhu is still writing: he looks down and the cloud holds its room. */
  loading: boolean;
  onClose: () => void;
}) {
  const t = useTranslations("panel");
  const { palette } = useThemeTokens();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const mascot = useRef(new Animated.Value(0)).current;
  const smallDot = useRef(new Animated.Value(0)).current;
  const bigDot = useRef(new Animated.Value(0)).current;
  const cloud = useRef(new Animated.Value(0)).current;
  const thinking = useRef(new Animated.Value(0)).current;
  const [entered, setEntered] = useState(false);
  const [shown, setShown] = useState(0);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (!visible) return;
    if (reduceMotion) {
      for (const value of [mascot, smallDot, bigDot, cloud]) value.setValue(1);
      setEntered(true);
      return;
    }
    setEntered(false);
    for (const value of [mascot, smallDot, bigDot, cloud]) value.setValue(0);
    const part = (value: Animated.Value, delay: number, duration: number) =>
      Animated.timing(value, { toValue: 1, delay, duration, easing: EASE, useNativeDriver: true });
    const entrance = Animated.parallel([
      part(mascot, 0, 280),
      part(smallDot, 120, 200),
      part(bigDot, 180, 200),
      part(cloud, 240, 320),
    ]);
    entrance.start(({ finished }) => {
      if (finished) setEntered(true);
    });
    return () => entrance.stop();
  }, [bigDot, cloud, mascot, reduceMotion, smallDot, visible]);

  useEffect(() => {
    if (!visible || !loading || reduceMotion) return;
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(thinking, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(thinking, { toValue: 0, duration: 700, useNativeDriver: true }),
      ]),
    );
    pulse.start();
    return () => pulse.stop();
  }, [loading, thinking, visible]);

  // The words arrive a letter at a time once the cloud is open.
  const speakable = visible && entered && !loading && text ? text : null;
  useEffect(() => {
    if (reduceMotion) {
      setShown(speakable?.length ?? 0);
      return;
    }
    setShown(0);
    if (!speakable) return;
    const timer = setInterval(() => {
      setShown((count) => {
        if (count >= speakable.length) {
          clearInterval(timer);
          return count;
        }
        return count + 1;
      });
    }, CHAR_MS);
    return () => clearInterval(timer);
  }, [reduceMotion, speakable]);

  const speaking = speakable !== null && shown < speakable.length;

  if (!visible) return null;

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("mood_speech_close")}
          onPress={onClose}
          style={[StyleSheet.absoluteFill, styles.backdrop]}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("mood_speech_close")}
          onPress={onClose}
          style={[styles.close, { top: insets.top + 12 }]}
        >
          <CloseCircleIcon size={24} color="#FFFFFF" />
        </Pressable>

        <View style={styles.stage}>
          <Animated.View
            style={[
              styles.cloud,
              {
                opacity: cloud,
                transform: [
                  { scale: cloud.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] }) },
                ],
              },
            ]}
          >
            <Svg style={StyleSheet.absoluteFill} viewBox="0 0 400 280" preserveAspectRatio="none">
              <Path
                d={CLOUD}
                fill={palette.surface}
                stroke={palette.secondary}
                strokeWidth={1.5}
                vectorEffect="non-scaling-stroke"
              />
            </Svg>
            <AppText style={[styles.badge, { color: palette.secondary }]}>
              {t("mood_speech_badge")}
            </AppText>
            <ScrollView style={{ maxHeight: height * 0.4 }} contentContainerStyle={styles.words}>
              {loading || !text ? (
                // The room a note takes (two or three sentences), so it lands without a jump.
                <View style={styles.thinking}>
                  <Animated.View
                    style={{
                      opacity: thinking.interpolate({ inputRange: [0, 1], outputRange: [0.45, 1] }),
                    }}
                  >
                    <AppText style={[styles.text, { color: palette.secondary }]}>
                      {t("mood_speech_thinking")}
                    </AppText>
                  </Animated.View>
                </View>
              ) : (
                <AppText accessibilityLabel={text} style={styles.text}>
                  {text.slice(0, shown)}
                  {/* The unspoken rest holds its place, so the cloud never grows mid-sentence. */}
                  <AppText style={[styles.text, styles.unspoken]}>{text.slice(shown)}</AppText>
                </AppText>
              )}
            </ScrollView>
            <View style={[styles.action, loading && styles.hidden]}>
              <LedgeButton accessibilityLabel={t("mood_speech_cta")} onPress={onClose}>
                {(ink) => (
                  <AppText style={[styles.actionLabel, { color: ink }]}>
                    {t("mood_speech_cta")}
                  </AppText>
                )}
              </LedgeButton>
            </View>
          </Animated.View>

          <View style={styles.trail}>
            <Dot value={bigDot} style={styles.bigDot} />
            <Dot value={smallDot} style={styles.smallDot} />
          </View>

          <Animated.View
            style={[
              styles.mascot,
              {
                opacity: mascot,
                transform: [
                  { translateY: mascot.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) },
                  { scale: mascot.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] }) },
                ],
              },
            ]}
          >
            <SpeakingPuhu speaking={speaking} loading={loading} />
          </Animated.View>
        </View>
      </View>
    </Modal>
  );
}

function Dot({ value, style }: { value: Animated.Value; style: object }) {
  const { palette } = useThemeTokens();
  return (
    <Animated.View
      style={[
        styles.dot,
        style,
        {
          backgroundColor: palette.surface,
          borderColor: palette.secondary,
          opacity: value,
          transform: [{ scale: value }],
        },
      ]}
    />
  );
}

type Frame = keyof (typeof puhuSpeakingArt)["free"];
const FRAMES: Frame[] = ["rest", "talkClosed", "blink", "lookDown"];

/** Every frame stays mounted, so speaking never waits for an image to decode. */
function SpeakingPuhu({ speaking, loading }: { speaking: boolean; loading: boolean }) {
  const frames = puhuSpeakingArt[useIsPremium() ? "premium" : "free"];
  const [mouthClosed, setMouthClosed] = useState(false);
  const [blinking, setBlinking] = useState(false);

  useEffect(() => {
    if (!speaking) return;
    const timer = setInterval(() => setMouthClosed((closed) => !closed), 150);
    return () => clearInterval(timer);
  }, [speaking]);

  useEffect(() => {
    setBlinking(false);
    if (speaking || loading) return;
    let open: ReturnType<typeof setTimeout> | undefined;
    const timer = setInterval(() => {
      setBlinking(true);
      open = setTimeout(() => setBlinking(false), 180);
    }, 4500);
    return () => {
      clearInterval(timer);
      clearTimeout(open);
    };
  }, [loading, speaking]);

  const current: Frame = loading
    ? "lookDown"
    : speaking
      ? mouthClosed
        ? "talkClosed"
        : "rest"
      : blinking
        ? "blink"
        : "rest";

  return (
    <View style={styles.frames}>
      {FRAMES.map((frame) => (
        <Image
          key={frame}
          source={frames[frame]}
          style={[StyleSheet.absoluteFill, { opacity: frame === current ? 1 : 0 }]}
          contentFit="contain"
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  backdrop: {
    backgroundColor: "rgba(0, 0, 0, 0.65)",
  },
  close: {
    position: "absolute",
    right: 16,
    zIndex: 3,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  stage: {
    width: "100%",
    maxWidth: 384,
    alignItems: "center",
  },
  // The inline inset follows the outline's side lobes at every width.
  cloud: {
    width: "100%",
    paddingVertical: 60,
    paddingHorizontal: "15%",
    transformOrigin: "bottom",
  },
  badge: {
    marginBottom: 10,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "800",
  },
  words: {
    padding: 4,
  },
  thinking: {
    minHeight: 120,
    justifyContent: "center",
  },
  text: {
    fontSize: 16,
    lineHeight: 26,
    fontWeight: "500",
  },
  unspoken: {
    color: "transparent",
  },
  action: {
    marginTop: 16,
  },
  actionLabel: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "800",
  },
  hidden: {
    opacity: 0,
  },
  trail: {
    width: 56,
    height: 34,
  },
  dot: {
    position: "absolute",
    borderWidth: 1.5,
  },
  bigDot: {
    left: 0,
    top: -4,
    width: 20,
    height: 16,
    borderRadius: 10,
  },
  smallDot: {
    left: 20,
    top: 18,
    width: 10,
    height: 8,
    borderRadius: 5,
  },
  mascot: {
    width: 96,
    height: 96,
    marginTop: 4,
    transformOrigin: "bottom",
  },
  frames: {
    flex: 1,
  },
});
