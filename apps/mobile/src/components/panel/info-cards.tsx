import { Pressable, StyleSheet, View } from "react-native";
import { SnowflakeIcon } from "@solar-icons/react-native/bold/snowflake";
import { HourglassIcon } from "@solar-icons/react-native/linear/hourglass";
import type { CommunityLevelView, CountdownDto } from "@mentor/types";
import { useLocale, useTranslations } from "../../providers/i18n-provider.js";
import { useThemeTokens } from "../../providers/theme-provider.js";
import { AppText } from "../ui/text.js";
import { PanelCard, PanelCardTitle, ProgressLine } from "./primitives.js";

/**
 * "Sınava kalan": the official countdown, verbatim from the server (guardrail §4 #1), calm and
 * never alarm-red. The card opens the exam guide, where the source of the date is shown.
 */
export function CountdownCard({
  countdown,
  onPress,
}: {
  countdown: CountdownDto;
  onPress: () => void;
}) {
  const t = useTranslations("panel");
  const { locale } = useLocale();
  const { palette } = useThemeTokens();
  const today = countdown.daysRemaining <= 0;
  const label = t("countdown_title").toLocaleUpperCase(locale === "tr" ? "tr-TR" : "en-US");

  return (
    <Pressable accessibilityRole="button" onPress={onPress}>
      <PanelCard style={styles.countdown}>
        <HourglassIcon size={40} color={palette.main} strokeWidth={1.5} />
        <View style={styles.countdownText}>
          <AppText style={[styles.countdownLabel, { color: palette.secondary }]}>{label}</AppText>
          {today ? (
            <AppText style={styles.countdownValue}>{t("countdown_today")}</AppText>
          ) : (
            <View style={styles.countdownRow}>
              <AppText tabularNums style={styles.countdownValue}>
                {countdown.daysRemaining}
              </AppText>
              <AppText style={[styles.countdownUnit, { color: palette.secondary }]}>
                {t("countdown_day_unit")}
              </AppText>
            </View>
          )}
          <AppText style={[styles.countdownCaption, { color: palette.secondary }]}>
            {countdown.examDateLabel
              ? `${countdown.examName} · ${countdown.examDateLabel}`
              : countdown.examName}
          </AppText>
        </View>
      </PanelCard>
    </Pressable>
  );
}

export { GoalCard } from "../vision-board/panel-goal-card.js";

type LevelNameKey = `level_${CommunityLevelView["key"]}`;

/** "Yolculuğun": the level, the XP to the next one, and the freezes that keep a missed day. */
export function JourneyCard({
  level,
  freezeTokens,
}: {
  level: CommunityLevelView;
  freezeTokens: number;
}) {
  const t = useTranslations("panel");
  const { locale } = useLocale();
  const { palette } = useThemeTokens();
  const name = t(`level_${level.key}` as LevelNameKey);
  const group = locale === "tr" ? "." : ",";
  const format = (value: number) => String(value).replace(/\B(?=(\d{3})+(?!\d))/g, group);

  return (
    <PanelCard style={styles.journey}>
      <PanelCardTitle>{t("journey_title")}</PanelCardTitle>
      <View style={styles.levelRow}>
        <AppText numberOfLines={1} style={[styles.levelText, { color: palette.secondary }]}>
          {t("journey_level", { tier: level.tier, name })}
        </AppText>
        {level.progress ? (
          <AppText tabularNums style={[styles.levelXp, { color: palette.secondary }]}>
            {t("journey_xp", {
              current: format(level.progress.current),
              target: format(level.progress.target),
            })}
          </AppText>
        ) : null}
      </View>
      {level.progress ? (
        <ProgressLine label={name} value={level.progress.current} max={level.progress.target} />
      ) : (
        <AppText style={[styles.levelText, { color: palette.secondary }]}>
          {t("journey_complete")}
        </AppText>
      )}
      {freezeTokens > 0 ? (
        <View style={styles.freeze}>
          <SnowflakeIcon size={16} color={palette.playSelectedInk} />
          <AppText style={[styles.freezeText, { color: palette.playSelectedInk }]}>
            {t("journey_freezes", { count: freezeTokens })}
          </AppText>
        </View>
      ) : null}
    </PanelCard>
  );
}

const styles = StyleSheet.create({
  countdown: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 16,
  },
  countdownText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  countdownLabel: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "600",
    letterSpacing: 0.4,
  },
  countdownRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 8,
  },
  countdownValue: {
    fontSize: 30,
    lineHeight: 36,
    fontWeight: "800",
  },
  countdownUnit: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "700",
  },
  countdownCaption: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "500",
  },
  journey: {
    gap: 12,
  },
  levelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  levelText: {
    flexShrink: 1,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "500",
  },
  levelXp: {
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "500",
  },
  freeze: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  freezeText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "700",
  },
});
