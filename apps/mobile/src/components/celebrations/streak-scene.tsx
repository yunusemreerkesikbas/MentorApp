import { useEffect, useRef } from "react";
import { Animated, Easing, Modal, Pressable, StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { useReducedMotion } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Defs, LinearGradient, Path, RadialGradient, Circle, Stop } from "react-native-svg";
import { celebrationWeekIsos, formatWeekdayShort, isCelebrationDayLit } from "@mentor/core";
import { art } from "../../lib/art.js";
import { haptics } from "../../lib/haptics.js";
import { mixHex } from "../../lib/layout.js";
import { useLocale, useTranslations } from "../../providers/i18n-provider.js";
import { useThemeTokens } from "../../providers/theme-provider.js";
import { AppText } from "../ui/text.js";

/** The web sheet's soft peak (`clipPathUnits="objectBoundingBox"`), drawn in a 1×1 box. */
const PEAK =
  "M0,0.14 C0.08,0.14 0.18,0.13 0.28,0.08 C0.38,0.03 0.45,0.005 0.5,0 C0.55,0.005 0.62,0.03 0.72,0.08 C0.82,0.13 0.92,0.14 1,0.14 L1,1 L0,1 Z";
const SPARKLE = "M12 1.5 13.8 9.2 21.5 11 13.8 12.8 12 20.5 10.2 12.8 2.5 11 10.2 9.2 12 1.5Z";

/**
 * "N günlük seri": the day's first streak credit (the web's `StreakCelebration`). Same sheet,
 * week row and words; the web's animated flame file is an SVG animation React Native cannot
 * play, so the flame is drawn here and breathes with one loop.
 */
export function StreakScene({ days, onClose }: { days: number; onClose: () => void }) {
  const t = useTranslations("celebration");
  const { locale } = useLocale();
  const { palette } = useThemeTokens();
  const insets = useSafeAreaInsets();
  const rise = useRef(new Animated.Value(0)).current;
  const hero = useRef(new Animated.Value(0)).current;
  const badge = useRef(new Animated.Value(0)).current;
  const row = useRef(new Animated.Value(0)).current;
  const breath = useRef(new Animated.Value(0)).current;
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    haptics.success();
    if (reduceMotion) {
      // The web swaps its moving flame for a still one; here everything simply stands in place.
      for (const value of [rise, hero, badge, row]) value.setValue(1);
      return;
    }
    const entrance = Animated.parallel([
      Animated.spring(rise, { toValue: 1, damping: 22, stiffness: 260, useNativeDriver: true }),
      Animated.sequence([
        Animated.delay(80),
        Animated.spring(hero, { toValue: 1, damping: 11, stiffness: 240, useNativeDriver: true }),
      ]),
      Animated.sequence([
        Animated.delay(280),
        Animated.spring(badge, { toValue: 1, damping: 9, stiffness: 300, useNativeDriver: true }),
      ]),
      Animated.sequence([
        Animated.delay(280),
        Animated.timing(row, {
          toValue: 1,
          duration: 560,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
    ]);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breath, { toValue: 1, duration: 1200, useNativeDriver: true }),
        Animated.timing(breath, { toValue: 0, duration: 1200, useNativeDriver: true }),
      ]),
    );
    entrance.start();
    loop.start();
    return () => {
      entrance.stop();
      loop.stop();
    };
  }, [badge, breath, hero, reduceMotion, rise, row]);

  const week = celebrationWeekIsos(days);

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("close")}
          onPress={onClose}
          style={[StyleSheet.absoluteFill, styles.backdrop]}
        />

        <Animated.View
          style={{
            opacity: rise,
            transform: [{ translateY: rise.interpolate({ inputRange: [0, 1], outputRange: [56, 0] }) }],
          }}
        >
          <View pointerEvents="none" style={styles.hero}>
            <Animated.View
              style={[
                styles.heroGlow,
                {
                  opacity: breath.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0.9] }),
                  transform: [
                    { scale: breath.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1.08] }) },
                  ],
                },
              ]}
            >
              <Svg width={180} height={180}>
                <Defs>
                  <RadialGradient id="streakGlow" cx="50%" cy="50%" r="50%">
                    <Stop offset="0" stopColor="#FFF1C2" stopOpacity={0.75} />
                    <Stop offset="1" stopColor={palette.streakCore} stopOpacity={0} />
                  </RadialGradient>
                </Defs>
                <Circle cx={90} cy={90} r={90} fill="url(#streakGlow)" />
              </Svg>
            </Animated.View>
            <Sparkle style={styles.sparkleLeft} value={breath} />
            <Sparkle style={styles.sparkleRight} value={breath} reverse />
            <Animated.View
              style={{
                opacity: hero,
                transform: [
                  { translateY: hero.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) },
                  { scale: hero.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) },
                ],
              }}
            >
              <Animated.View
                style={{
                  transform: [
                    { scale: breath.interpolate({ inputRange: [0, 1], outputRange: [1, 1.05] }) },
                  ],
                }}
              >
                <Flame core={palette.streakCore} />
              </Animated.View>
              <Animated.View
                style={[
                  styles.badge,
                  {
                    transform: [
                      { scale: badge },
                      {
                        rotate: badge.interpolate({
                          inputRange: [0, 1],
                          outputRange: ["-12deg", "0deg"],
                        }),
                      },
                    ],
                  },
                ]}
              >
                <AppText style={[styles.badgeLabel, { color: palette.streak }]}>{days}</AppText>
              </Animated.View>
            </Animated.View>
          </View>

          <View style={[styles.sheet, { paddingBottom: Math.max(24, insets.bottom + 16) }]}>
            <Svg style={StyleSheet.absoluteFill} viewBox="0 0 1 1" preserveAspectRatio="none">
              <Defs>
                <LinearGradient id="streakSheet" x1="0.35" y1="0" x2="0.65" y2="1">
                  <Stop offset="0" stopColor={mixHex(palette.streak, "#9a3412", 0.88)} />
                  <Stop offset="0.48" stopColor={mixHex(palette.streak, "#c2410c", 0.72)} />
                  <Stop offset="1" stopColor={mixHex(palette.streakCore, palette.streak, 0.55)} />
                </LinearGradient>
              </Defs>
              <Path d={PEAK} fill="url(#streakSheet)" />
            </Svg>

            <View style={styles.content}>
              <AppText accessibilityRole="header" style={styles.title}>
                {t("streak_title", { days })}
              </AppText>

              <View
                accessible
                accessibilityRole="image"
                accessibilityLabel={t("streak_title", { days })}
                style={styles.week}
              >
                {week.map((iso, index) => {
                  const lit = isCelebrationDayLit(index, days);
                  const start = index * 0.09;
                  const appear = row.interpolate({
                    inputRange: [start, start + 0.4],
                    outputRange: [0, 1],
                    extrapolate: "clamp",
                  });
                  return (
                    <Animated.View
                      key={iso}
                      style={[
                        styles.day,
                        {
                          opacity: appear,
                          transform: [
                            {
                              scale: appear.interpolate({
                                inputRange: [0, 1],
                                outputRange: [0.85, 1],
                              }),
                            },
                          ],
                        },
                      ]}
                    >
                      <View style={[styles.dayDot, lit ? styles.dayDotLit : styles.dayDotQuiet]}>
                        <Image
                          source={art.flame}
                          style={[styles.dayFlame, !lit && styles.dayFlameQuiet]}
                          contentFit="contain"
                        />
                      </View>
                      <AppText style={[styles.dayLabel, !lit && styles.dayLabelQuiet]}>
                        {formatWeekdayShort(iso, locale).toLocaleUpperCase(
                          locale === "tr" ? "tr-TR" : "en-US",
                        )}
                      </AppText>
                    </Animated.View>
                  );
                })}
              </View>

              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  haptics.lightImpact();
                  onClose();
                }}
                style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
              >
                <AppText style={[styles.ctaLabel, { color: palette.streak }]}>
                  {t("streak_cta")}
                </AppText>
              </Pressable>
            </View>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

function Sparkle({
  style,
  value,
  reverse = false,
}: {
  style: object;
  value: Animated.Value;
  reverse?: boolean;
}) {
  return (
    <Animated.View
      style={[
        styles.sparkle,
        style,
        {
          opacity: value.interpolate({
            inputRange: [0, 1],
            outputRange: reverse ? [1, 0.4] : [0.4, 1],
          }),
          transform: [
            {
              scale: value.interpolate({
                inputRange: [0, 1],
                outputRange: reverse ? [1.15, 0.8] : [0.8, 1.15],
              }),
            },
          ],
        },
      ]}
    >
      <Svg width={18} height={18} viewBox="0 0 24 24">
        <Path d={SPARKLE} fill="#FFFFFF" />
      </Svg>
    </Animated.View>
  );
}

/** The hero flame: an outer tongue and a warm core. */
function Flame({ core }: { core: string }) {
  return (
    <Svg width={100} height={140} viewBox="0 0 100 140">
      <Defs>
        <LinearGradient id="flameOuter" x1="0.5" y1="0" x2="0.5" y2="1">
          <Stop offset="0" stopColor="#FF8016" />
          <Stop offset="1" stopColor="#F44236" />
        </LinearGradient>
        <LinearGradient id="flameCore" x1="0.5" y1="0" x2="0.5" y2="1">
          <Stop offset="0" stopColor="#FFF1C2" />
          <Stop offset="1" stopColor={core} />
        </LinearGradient>
      </Defs>
      <Path
        d="M52 4 C58 30 88 46 88 86 C88 114 71 134 50 134 C29 134 12 114 12 88 C12 70 20 58 28 48 C30 60 36 66 42 66 C40 44 42 22 52 4 Z"
        fill="url(#flameOuter)"
      />
      <Path
        d="M51 62 C56 78 70 86 70 104 C70 118 61 128 50 128 C39 128 30 118 30 105 C30 96 34 90 38 85 C40 91 43 94 46 94 C45 82 46 72 51 62 Z"
        fill="url(#flameCore)"
      />
    </Svg>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdrop: {
    backgroundColor: "rgba(26, 26, 46, 0.55)",
  },
  hero: {
    alignSelf: "center",
    width: 320,
    height: 140,
    marginBottom: -64,
    zIndex: 2,
    alignItems: "center",
    justifyContent: "flex-end",
  },
  heroGlow: {
    position: "absolute",
    top: -20,
  },
  sparkle: {
    position: "absolute",
  },
  sparkleLeft: {
    left: 62,
    top: 24,
  },
  sparkleRight: {
    right: 54,
    top: 44,
  },
  badge: {
    position: "absolute",
    right: -10,
    bottom: 10,
    minWidth: 40,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    elevation: 3,
  },
  badgeLabel: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: "800",
  },
  sheet: {
    paddingTop: 84,
    paddingHorizontal: 24,
  },
  content: {
    alignSelf: "center",
    width: "100%",
    maxWidth: 320,
    alignItems: "center",
  },
  title: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: "800",
    color: "#FFFFFF",
    textAlign: "center",
  },
  week: {
    marginTop: 20,
    width: "100%",
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 4,
  },
  day: {
    flex: 1,
    alignItems: "center",
    gap: 6,
  },
  dayDot: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  dayDotLit: {
    backgroundColor: "#FFFFFF",
  },
  dayDotQuiet: {
    backgroundColor: "rgba(255, 255, 255, 0.2)",
  },
  dayFlame: {
    width: 18,
    height: 18,
  },
  dayFlameQuiet: {
    opacity: 0.35,
  },
  dayLabel: {
    fontSize: 10,
    lineHeight: 14,
    fontWeight: "800",
    letterSpacing: 0.4,
    color: "#FFFFFF",
  },
  dayLabelQuiet: {
    color: "rgba(255, 255, 255, 0.55)",
  },
  cta: {
    marginTop: 28,
    width: "100%",
    minHeight: 48,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    backgroundColor: "#FFFFFF",
  },
  ctaPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  ctaLabel: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "800",
  },
});
