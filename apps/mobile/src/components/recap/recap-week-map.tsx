import { StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import Animated from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getWeeklyRecapPeakDayStory, getWeeklyRecapWeekMapPhase } from "@mentor/core";
import type { WeeklyReviewDto } from "@mentor/types";
import { recapArt } from "../../lib/art.js";
import { useLocale, useTranslations } from "../../providers/i18n-provider.js";
import { AppText } from "../ui/text.js";
import { RecapClip, Shade } from "./recap-character-video.js";
import { RECAP } from "./recap-colors.js";
import { RecapDecor } from "./recap-decor.js";
import { recapLocaleTag, riseIn, useRecapPuhu } from "./recap-kit.js";

/** Puhu's fire clip for the first 4 s, then the week's active days and its power day. */
export function RecapWeekMap({
  review,
  elapsedMs,
  playing,
  reducedMotion,
}: {
  review: WeeklyReviewDto;
  elapsedMs: number;
  playing: boolean;
  reducedMotion: boolean;
}) {
  const t = useTranslations("recap");
  const { locale } = useLocale();
  const insets = useSafeAreaInsets();
  const proud = useRecapPuhu("proud");
  const daysVisible = getWeeklyRecapWeekMapPhase(elapsedMs) === "active_days";
  const peak = getWeeklyRecapPeakDayStory(review, recapLocaleTag(locale));

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <RecapClip
        source={recapArt.fire}
        elapsedMs={elapsedMs}
        playing={playing}
        limitMs={4_000}
        fallback={
          <View style={[StyleSheet.absoluteFill, styles.fallback]}>
            <Image source={proud} style={styles.proud} contentFit="contain" />
          </View>
        }
      />
      <Shade style={styles.topShade} stops={[[0, 0.75], [0.5, 0.3], [1, 0]]} />
      <Shade style={styles.bottomShade} stops={[[0, 0], [0.5, 0.3], [1, 0.75]]} />
      <RecapDecor kind="week_map" reducedMotion={reducedMotion} />

      <View style={[styles.content, { paddingTop: insets.top + 96, paddingBottom: insets.bottom + 48 }]}>
        <View style={styles.head}>
          {daysVisible ? (
            <Animated.View key="days" entering={riseIn(reducedMotion)} style={styles.center}>
              <AppText tabularNums style={styles.days}>
                {review.recap.activeDays}
              </AppText>
              <AppText style={styles.daysLabel}>{t("week_map_active_days")}</AppText>
            </Animated.View>
          ) : (
            <Animated.View key="headline" entering={riseIn(reducedMotion)}>
              <AppText accessibilityRole="header" style={styles.title}>
                {t("week_map_title")}
              </AppText>
            </Animated.View>
          )}
        </View>
        {daysVisible && peak ? (
          <Animated.View entering={riseIn(reducedMotion, 420)} style={styles.peak}>
            <AppText style={styles.peakLabel}>
              {t("week_map_power_day", { day: peak.dayLabel, minutes: peak.focusMinutes }).toLocaleUpperCase(
                recapLocaleTag(locale),
              )}
            </AppText>
            <AppText style={styles.peakMessage}>{peak.message}</AppText>
          </Animated.View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: RECAP.sky,
  },
  proud: {
    width: 180,
    height: 180,
  },
  topShade: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 288,
  },
  bottomShade: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 224,
  },
  content: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 24,
  },
  head: {
    minHeight: 112,
    alignSelf: "stretch",
    alignItems: "center",
    justifyContent: "center",
  },
  center: {
    alignItems: "center",
  },
  days: {
    color: "#ffffff",
    fontSize: 72,
    lineHeight: 76,
    fontWeight: "900",
  },
  daysLabel: {
    marginTop: 4,
    color: "#ffffff",
    fontSize: 20,
    lineHeight: 28,
    fontWeight: "900",
  },
  title: {
    maxWidth: 384,
    color: "#ffffff",
    fontSize: 36,
    lineHeight: 36,
    fontWeight: "900",
    letterSpacing: -1.44,
    textAlign: "center",
  },
  peak: {
    marginTop: "auto",
    maxWidth: 384,
    alignItems: "center",
  },
  peakLabel: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "900",
    letterSpacing: 1.96,
    textAlign: "center",
  },
  peakMessage: {
    marginTop: 4,
    color: "rgba(255,255,255,0.9)",
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "700",
    textAlign: "center",
  },
});
