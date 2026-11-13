import { useEffect, useRef, type ReactNode } from "react";
import { Animated, Easing, Modal, Pressable, StyleSheet, View } from "react-native";
import { useReducedMotion } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, Defs, RadialGradient, Stop } from "react-native-svg";
import { CloseCircleIcon } from "@solar-icons/react-native/linear/close-circle";
import { haptics } from "../../lib/haptics.js";
import { AppText } from "../ui/text.js";

/**
 * The stage every reward scene plays on (the web's `.achievement-scene-theme`): a night sky that
 * ignores the light/dark toggle, the art lit from behind, the words arriving after it, and one
 * ledge to leave by.
 *
 * The web paints this with a canvas engine and its own sound. Here the same beats are rebuilt with
 * `Animated` on the native driver: the art lands, a burst leaves it, the copy rises, the ledge
 * comes up; the phone marks the landing with a haptic instead of a sound.
 */
const NIGHT = {
  top: "#07122A",
  bottom: "#1B2F66",
  ink: "#F3F6FA",
  body: "#C9D4E8",
  eyebrow: "#FFD15C",
  star: "#FFFFFF",
} as const;

const STARS: readonly { x: number; y: number; size: number; phase: 0 | 1 }[] = [
  { x: 8, y: 9, size: 3, phase: 0 },
  { x: 24, y: 17, size: 2, phase: 1 },
  { x: 71, y: 8, size: 3, phase: 1 },
  { x: 90, y: 20, size: 2, phase: 0 },
  { x: 14, y: 36, size: 2, phase: 1 },
  { x: 84, y: 41, size: 3, phase: 0 },
  { x: 5, y: 62, size: 2, phase: 0 },
  { x: 93, y: 66, size: 2, phase: 1 },
  { x: 20, y: 83, size: 3, phase: 1 },
  { x: 78, y: 88, size: 2, phase: 0 },
  { x: 48, y: 5, size: 2, phase: 0 },
  { x: 60, y: 93, size: 2, phase: 1 },
];

const GLOW_SIZE = 360;
const BURST_COUNT = 12;
const BURST_COLORS = ["#FFD15C", "#55ACEE", "#FFFFFF"] as const;

export interface SceneShellProps {
  art: ReactNode;
  eyebrow: string;
  title: string;
  body?: string | null;
  /** A small line between the title and the body (a Coin receipt's reason). */
  note?: string | null;
  cta: string;
  onContinue: () => void;
  busy?: boolean;
  error?: string | null;
  /** The ledge's colours: sky blue for a step forward, gold for Coin. */
  tone?: "play" | "gold";
  closeLabel?: string;
  onClose?: () => void;
}

export function SceneShell({
  art,
  eyebrow,
  title,
  body,
  note,
  cta,
  onContinue,
  busy = false,
  error,
  tone = "play",
  closeLabel,
  onClose,
}: SceneShellProps) {
  const insets = useSafeAreaInsets();
  const land = useRef(new Animated.Value(0)).current;
  const burst = useRef(new Animated.Value(0)).current;
  const copy = useRef(new Animated.Value(0)).current;
  const ledge = useRef(new Animated.Value(0)).current;
  const twinkle = useRef(new Animated.Value(0)).current;
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const beat = setTimeout(() => haptics.success(), 260);
    if (reduceMotion) {
      // Everything in place at once, nothing that keeps moving; the haptic still marks it.
      for (const value of [land, copy, ledge]) value.setValue(1);
      return () => clearTimeout(beat);
    }
    const entrance = Animated.sequence([
      Animated.spring(land, { toValue: 1, damping: 11, stiffness: 150, useNativeDriver: true }),
      Animated.parallel([
        Animated.timing(burst, {
          toValue: 1,
          duration: 620,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(copy, {
          toValue: 1,
          duration: 380,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
      Animated.spring(ledge, { toValue: 1, damping: 14, stiffness: 170, useNativeDriver: true }),
    ]);
    const sky = Animated.loop(
      Animated.sequence([
        Animated.timing(twinkle, { toValue: 1, duration: 1600, useNativeDriver: true }),
        Animated.timing(twinkle, { toValue: 0, duration: 1600, useNativeDriver: true }),
      ]),
    );
    entrance.start();
    sky.start();
    // The landing (`beat` above) is the moment the web marks with sound.
    return () => {
      entrance.stop();
      sky.stop();
      clearTimeout(beat);
    };
  }, [burst, copy, land, ledge, reduceMotion, twinkle]);

  const gold = tone === "gold";

  return (
    <Modal
      visible
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose ?? onContinue}
    >
      <View
        style={[
          styles.stage,
          {
            paddingTop: insets.top + 16,
            paddingBottom: insets.bottom + 20,
            experimental_backgroundImage: `linear-gradient(180deg, ${NIGHT.top} 0%, ${NIGHT.bottom} 100%)`,
          },
        ]}
      >
        {STARS.map((star, index) => (
          <Animated.View
            key={index}
            style={[
              styles.star,
              {
                left: `${star.x}%`,
                top: `${star.y}%`,
                width: star.size,
                height: star.size,
                borderRadius: star.size / 2,
                opacity: twinkle.interpolate({
                  inputRange: [0, 1],
                  outputRange: star.phase === 0 ? [0.25, 0.9] : [0.9, 0.25],
                }),
              },
            ]}
          />
        ))}

        {onClose ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={closeLabel}
            onPress={onClose}
            style={[styles.close, { top: insets.top + 8 }]}
          >
            <CloseCircleIcon size={28} color={NIGHT.body} />
          </Pressable>
        ) : null}

        <View style={styles.centre}>
          <View style={styles.artBox}>
            <Animated.View
              style={[
                styles.glow,
                {
                  opacity: land,
                  transform: [{ scale: land.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) }],
                },
              ]}
            >
              {/* A light that fades to nothing; a flat tinted disc reads as a grey plate. */}
              <Svg width={GLOW_SIZE} height={GLOW_SIZE}>
                <Defs>
                  <RadialGradient id="sceneGlow" cx="50%" cy="50%" r="50%">
                    <Stop offset="0" stopColor={gold ? "#FFD15C" : "#7CC4FF"} stopOpacity={0.5} />
                    {/* Gold over navy greys out as it thins, so its halo stays tighter than the blue one. */}
                    <Stop
                      offset={gold ? 0.42 : 0.55}
                      stopColor={gold ? "#FFD15C" : "#55ACEE"}
                      stopOpacity={gold ? 0.1 : 0.16}
                    />
                    <Stop offset="1" stopColor={gold ? "#FFD15C" : "#55ACEE"} stopOpacity={0} />
                  </RadialGradient>
                </Defs>
                <Circle cx={GLOW_SIZE / 2} cy={GLOW_SIZE / 2} r={GLOW_SIZE / 2} fill="url(#sceneGlow)" />
              </Svg>
            </Animated.View>
            {Array.from({ length: BURST_COUNT }, (_, index) => {
              const angle = (index / BURST_COUNT) * Math.PI * 2;
              const reach = 150 + (index % 3) * 22;
              return (
                <Animated.View
                  key={index}
                  style={[
                    styles.spark,
                    {
                      backgroundColor: BURST_COLORS[index % BURST_COLORS.length],
                      opacity: burst.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 1, 0] }),
                      transform: [
                        {
                          translateX: burst.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0, Math.cos(angle) * reach],
                          }),
                        },
                        {
                          translateY: burst.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0, Math.sin(angle) * reach],
                          }),
                        },
                      ],
                    },
                  ]}
                />
              );
            })}
            <Animated.View
              style={{
                opacity: land.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, 1, 1] }),
                transform: [{ scale: land.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] }) }],
              }}
            >
              {art}
            </Animated.View>
          </View>

          <Animated.View
            style={[
              styles.copy,
              {
                opacity: copy,
                transform: [{ translateY: copy.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }],
              },
            ]}
          >
            <AppText style={[styles.eyebrow, { color: NIGHT.eyebrow }]}>{eyebrow}</AppText>
            <AppText accessibilityRole="header" style={[styles.title, { color: NIGHT.ink }]}>
              {title}
            </AppText>
            {note ? <AppText style={[styles.note, { color: NIGHT.body }]}>{note}</AppText> : null}
            {body ? <AppText style={[styles.body, { color: NIGHT.body }]}>{body}</AppText> : null}
          </Animated.View>
        </View>

        <Animated.View
          style={[
            styles.footer,
            {
              opacity: ledge,
              transform: [{ translateY: ledge.interpolate({ inputRange: [0, 1], outputRange: [28, 0] }) }],
            },
          ]}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ busy }}
            disabled={busy}
            onPress={() => {
              haptics.lightImpact();
              onContinue();
            }}
            style={({ pressed }) => [
              styles.ledge,
              {
                backgroundColor: gold ? "#FFD15C" : "#55ACEE",
                borderBottomColor: gold ? "#D79A12" : "#3B8FD0",
                borderBottomWidth: pressed ? 2 : 4,
                transform: [{ translateY: pressed ? 2 : 0 }],
                opacity: busy ? 0.6 : 1,
              },
            ]}
          >
            <AppText style={[styles.ledgeLabel, { color: gold ? "#3B2A05" : "#0F2233" }]}>{cta}</AppText>
          </Pressable>
          {error ? (
            <AppText accessibilityRole="alert" style={[styles.error, { color: NIGHT.body }]}>
              {error}
            </AppText>
          ) : null}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  stage: {
    flex: 1,
    backgroundColor: NIGHT.top,
    paddingHorizontal: 24,
  },
  star: {
    position: "absolute",
    backgroundColor: NIGHT.star,
  },
  close: {
    position: "absolute",
    right: 12,
    zIndex: 2,
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  centre: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  artBox: {
    width: 240,
    height: 240,
    alignItems: "center",
    justifyContent: "center",
  },
  glow: {
    position: "absolute",
    width: GLOW_SIZE,
    height: GLOW_SIZE,
  },
  spark: {
    position: "absolute",
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  copy: {
    marginTop: 28,
    alignItems: "center",
    maxWidth: 420,
  },
  eyebrow: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "800",
    textAlign: "center",
  },
  title: {
    marginTop: 6,
    fontSize: 30,
    lineHeight: 36,
    fontWeight: "800",
    textAlign: "center",
  },
  note: {
    marginTop: 6,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "800",
    letterSpacing: 0.6,
    textAlign: "center",
  },
  body: {
    marginTop: 12,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "600",
    textAlign: "center",
  },
  footer: {
    alignSelf: "center",
    width: "100%",
    maxWidth: 380,
  },
  ledge: {
    minHeight: 56,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  ledgeLabel: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "800",
  },
  error: {
    marginTop: 12,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "500",
    textAlign: "center",
  },
});
