import { useCallback, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { useFocusEffect } from "expo-router";
import type { TodayPanelResponse } from "@mentor/types";
import { recapArt } from "../../lib/art.js";
import { cardShadow } from "../../lib/layout.js";
import { isRecapOpened } from "../../lib/recap-opened.js";
import { useTranslations } from "../../providers/i18n-provider.js";
import { useThemeTokens } from "../../providers/theme-provider.js";
import { AppText } from "../ui/text.js";
import { RECAP } from "./recap-colors.js";

type RecapPeriod = NonNullable<TodayPanelResponse["weeklyRecapPeriod"]>;

/**
 * "Haftalık özetin hazır": the coral card on the panel (web `WeeklyRecapTeaser`, compact). It
 * turns into "watch again" once the week's story has loaded on this device.
 */
export function RecapTeaserCard({ period, onPress }: { period: RecapPeriod; onPress: () => void }) {
  const t = useTranslations("recap");
  const { radii } = useThemeTokens();
  const [opened, setOpened] = useState(() => isRecapOpened(period.startDate));

  // Back from the story, the card has to show its "watch again" face.
  useFocusEffect(
    useCallback(() => {
      setOpened(isRecapOpened(period.startDate));
    }, [period.startDate]),
  );

  const title = t(opened ? "teaser_replay_title" : "teaser_title");
  const message = t(opened ? "teaser_replay_message" : "teaser_message");

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${message}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        cardShadow,
        { borderRadius: radii.card, opacity: pressed ? 0.92 : 1 },
      ]}
    >
      <View style={[StyleSheet.absoluteFill, styles.clip, { borderRadius: radii.card }]}>
        <Image source={recapArt.decor.greenShape} style={styles.greenShape} contentFit="contain" />
        <Image source={recapArt.decor.silverWiggle} style={styles.silverWiggle} contentFit="contain" />
        <Image source={recapArt.decor.redPixel} style={styles.redPixel} contentFit="contain" />
      </View>
      <View style={styles.text}>
        <AppText style={styles.title}>{title}</AppText>
        <AppText style={styles.message}>{message}</AppText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: 176,
    backgroundColor: RECAP.coral,
  },
  clip: {
    overflow: "hidden",
  },
  // The web's phone-width placement: Tailwind units ×4.
  greenShape: {
    position: "absolute",
    left: -40,
    top: -112,
    width: 208,
    height: 208 * (370 / 430),
    transform: [{ rotate: "-10deg" }],
  },
  silverWiggle: {
    position: "absolute",
    right: -56,
    top: -112,
    width: 176,
    height: 176 * (780 / 540),
    transform: [{ rotate: "70deg" }],
  },
  redPixel: {
    position: "absolute",
    right: 48,
    top: 8,
    width: 80,
    height: 80,
    transform: [{ rotate: "12deg" }],
  },
  text: {
    flex: 1,
    justifyContent: "flex-end",
    padding: 20,
    paddingTop: 96,
  },
  title: {
    color: "#000000",
    fontSize: 24,
    lineHeight: 26,
    fontWeight: "900",
    letterSpacing: -0.84,
  },
  message: {
    marginTop: 8,
    color: "rgba(0,0,0,0.75)",
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600",
  },
});
