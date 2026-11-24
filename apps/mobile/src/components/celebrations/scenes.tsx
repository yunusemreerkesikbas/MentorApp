import { StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from "react-native-svg";
import type { AchievementCelebrationDto, JourneyLevelCelebrationView } from "@mentor/types";
import { achievementArt, levelArt } from "../../lib/art.js";
import { useLocale, useTranslations } from "../../providers/i18n-provider.js";
import { AppText } from "../ui/text.js";
import { SceneShell } from "./scene-shell.js";

const ART_SIZE = 220;
const MEDALLION_SIZE = 190;

type CelebrationKey = Parameters<ReturnType<typeof useTranslations<"celebration">>>[0];

/**
 * "Işık yandı": one achievement, or the summary of several counted from earlier effort. The words
 * follow the web's `AchievementCelebration` exactly; only the motion is simpler.
 */
export function AchievementScene({
  celebration,
  busy,
  error,
  onContinue,
}: {
  celebration: AchievementCelebrationDto;
  busy: boolean;
  error: string | null;
  onContinue: () => void;
}) {
  const t = useTranslations("celebration");
  const first = celebration.items[0];
  if (!first) return null;
  const summary = celebration.kind === "BACKFILL_SUMMARY";
  const count = celebration.items.length;

  return (
    <SceneShell
      art={
        <View>
          <Image source={achievementArt[first.artKey]} style={styles.art} contentFit="contain" />
          {summary && count > 1 ? (
            <View style={styles.more}>
              <AppText style={styles.moreLabel}>+{count - 1}</AppText>
            </View>
          ) : null}
        </View>
      }
      eyebrow={
        summary ? t("history_eyebrow", { count }) : t(`ach_${first.id}_eyebrow` as CelebrationKey)
      }
      title={summary ? t("history_title") : first.title}
      body={summary ? t("history_body", { count }) : t(`ach_${first.id}_body` as CelebrationKey)}
      cta={t("achievement_continue")}
      busy={busy}
      error={error}
      onContinue={onContinue}
    />
  );
}

/** A level reached on the journey: the medallion, its name and the line that goes with it. */
export function LevelScene({
  celebration,
  busy,
  error,
  onContinue,
}: {
  celebration: JourneyLevelCelebrationView;
  busy: boolean;
  error: string | null;
  onContinue: () => void;
}) {
  const t = useTranslations("celebration");
  const name = t(`level_${celebration.key}_name` as CelebrationKey);

  return (
    <SceneShell
      art={
        // The web's `JourneyLevelMedallion`: the square art cut round, under one flat tint that
        // makes twelve unrelated illustrations read as a set.
        <View style={styles.medallion}>
          <Image source={levelArt[celebration.key]} style={styles.medallionArt} contentFit="cover" />
          <View style={styles.medallionTint} />
        </View>
      }
      eyebrow={
        celebration.kind === "INTRODUCTION" ? t("level_intro_eyebrow") : t("level_up_eyebrow")
      }
      title={t("level_title", { tier: celebration.tier, name })}
      body={t(`level_${celebration.key}_story` as CelebrationKey)}
      cta={t("level_continue")}
      busy={busy}
      error={error}
      onContinue={onContinue}
    />
  );
}

/** Coin worth stopping for: the amount, what it was for, and a gold ledge. */
export function CoinScene({
  amount,
  label,
  onClose,
}: {
  amount: number;
  label?: string;
  onClose: () => void;
}) {
  const t = useTranslations("celebration");
  const { locale } = useLocale();

  return (
    <SceneShell
      tone="gold"
      art={<CoinArt />}
      // "Coin" is a name, not a Turkish word: Turkish casing would dot its I ("COİN").
      eyebrow={
        label
          ? label.toLocaleUpperCase(locale === "tr" ? "tr-TR" : "en-US").replaceAll("COİN", "COIN")
          : ""
      }
      title={t("coin_reward", { count: amount })}
      body={t("coin_subtitle")}
      cta={t("coin_cta")}
      onContinue={onClose}
      onClose={onClose}
      closeLabel={t("close")}
    />
  );
}

/** A gold coin drawn in place, so the scene needs no extra art file or animation runtime. */
export function CoinArt({ size = 150 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Defs>
        <LinearGradient id="coinFace" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#FFE680" />
          <Stop offset="1" stopColor="#F5A70B" />
        </LinearGradient>
      </Defs>
      <Circle cx={50} cy={52} r={44} fill="#C77F06" />
      <Circle cx={50} cy={48} r={44} fill="url(#coinFace)" />
      <Circle cx={50} cy={48} r={33} fill="none" stroke="#FFF3B8" strokeWidth={3} opacity={0.7} />
      <Path
        d="M30 34 Q50 20 70 34"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth={5}
        strokeLinecap="round"
        opacity={0.55}
      />
    </Svg>
  );
}

const styles = StyleSheet.create({
  art: {
    width: ART_SIZE,
    height: ART_SIZE,
  },
  medallion: {
    width: MEDALLION_SIZE,
    height: MEDALLION_SIZE,
    borderRadius: MEDALLION_SIZE / 2,
    overflow: "hidden",
  },
  medallionArt: {
    width: MEDALLION_SIZE,
    height: MEDALLION_SIZE,
  },
  medallionTint: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "#55ACEE",
    opacity: 0.18,
  },
  more: {
    position: "absolute",
    right: 4,
    bottom: 12,
    minWidth: 44,
    height: 32,
    borderRadius: 16,
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFD15C",
  },
  moreLabel: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "900",
    color: "#3B2A05",
  },
});
