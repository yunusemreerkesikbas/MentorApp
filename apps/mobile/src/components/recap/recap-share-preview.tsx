import { StyleSheet, useWindowDimensions, View } from "react-native";
import { Image } from "expo-image";
import { buildWeeklyRecapShareCardFacts, buildWeeklyRecapShareCardRows } from "@mentor/core";
import type { WeeklyReviewDto } from "@mentor/types";
import { recapArt } from "../../lib/art.js";
import { useThemeTokens } from "../../providers/theme-provider.js";
import { useTranslations } from "../../providers/i18n-provider.js";
import { AppText } from "../ui/text.js";
import { Shade } from "./recap-character-video.js";
import { RECAP } from "./recap-colors.js";
import { useRecapPuhu } from "./recap-kit.js";

/**
 * The week's card on the last slide (the web's `WeeklyRecapShareCardPreview`): the lakap over its
 * character, then effort numbers only. Sharing it comes with the next stop.
 */
export function RecapSharePreview({ review }: { review: WeeklyReviewDto }) {
  const t = useTranslations("recap");
  const { width } = useWindowDimensions();
  const { radii } = useThemeTokens();
  const proud = useRecapPuhu("proud");
  const facts = buildWeeklyRecapShareCardFacts(review);
  const topSubject = t("share_card_top_subject");
  const rows = buildWeeklyRecapShareCardRows(facts, {
    focus: t("share_card_focus"),
    activeDays: t("share_card_active_days"),
    sessions: t("share_card_sessions"),
    completedTasks: t("share_card_completed_tasks"),
    longestSession: t("share_card_longest_session"),
    longestRun: t("share_card_longest_run"),
    topSubject,
    minutes: (count) => t("share_card_minutes", { count }),
    days: (count) => t("share_card_days", { count }),
    count: (count) => t("share_card_count", { count }),
    subject: (name, minutes) => t("share_card_subject", { name, minutes }),
  });
  const subjectRow = rows.find((row) => row.label === topSubject) ?? null;
  const metricRows = rows.filter((row) => row !== subjectRow);
  const leadRow = metricRows[0] ?? null;
  const statRows = metricRows.slice(1, 6);

  return (
    <View style={[styles.card, { width: Math.min(width - 16, 370), borderRadius: radii.card }]}>
      <View style={styles.hero}>
        {facts.characterKey ? (
          <Image
            source={recapArt.characters[facts.characterKey].still}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
          />
        ) : (
          <View style={[StyleSheet.absoluteFill, styles.center]}>
            <Image source={proud} style={styles.proud} contentFit="contain" />
          </View>
        )}
        <Shade style={StyleSheet.absoluteFill} stops={[[0, 0.1], [0.5, 0], [1, 0.7]]} />
        <View style={styles.heroText}>
          <AppText style={styles.heroLabel}>{t("weekly_title_label")}</AppText>
          <AppText style={styles.heroTitle}>{facts.weeklyTitle ?? t("weekly_title_fallback")}</AppText>
        </View>
      </View>

      <View style={styles.body}>
        <AppText style={styles.title}>{t("share_card_title")}</AppText>
        {leadRow ? (
          <View style={styles.lead}>
            <AppText tabularNums style={styles.leadValue}>
              {leadRow.value}
            </AppText>
            <AppText style={styles.leadLabel}>{leadRow.label}</AppText>
          </View>
        ) : null}
        <View style={styles.stats}>
          {statRows.map((row) => (
            <View key={row.label} style={styles.stat}>
              <AppText tabularNums style={styles.statValue}>
                {row.value}
              </AppText>
              <AppText style={styles.statLabel}>{row.label}</AppText>
            </View>
          ))}
        </View>
        {subjectRow ? (
          <View style={styles.subject}>
            <AppText style={styles.subjectLabel}>{subjectRow.label}</AppText>
            <AppText style={styles.subjectValue}>{subjectRow.value}</AppText>
          </View>
        ) : null}
        <AppText style={styles.signature}>{t("share_card_signature")}</AppText>
      </View>
    </View>
  );
}

const ink = RECAP.ink;

const styles = StyleSheet.create({
  card: {
    overflow: "hidden",
    backgroundColor: RECAP.coral,
  },
  hero: {
    height: 176,
    overflow: "hidden",
    backgroundColor: RECAP.ink,
  },
  center: {
    alignItems: "center",
    justifyContent: "center",
  },
  proud: {
    width: 128,
    height: 128,
  },
  heroText: {
    position: "absolute",
    left: 20,
    right: 20,
    bottom: 28,
  },
  heroLabel: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "800",
  },
  heroTitle: {
    marginTop: 4,
    color: "#ffffff",
    fontSize: 30,
    lineHeight: 30,
    fontWeight: "900",
    letterSpacing: -0.9,
  },
  body: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 20,
  },
  title: {
    maxWidth: 256,
    color: ink,
    fontSize: 20,
    lineHeight: 21,
    fontWeight: "900",
    letterSpacing: -0.6,
  },
  lead: {
    marginTop: 12,
    paddingVertical: 12,
    borderTopWidth: 2,
    borderBottomWidth: 2,
    borderColor: "rgba(0,0,0,0.15)",
  },
  leadValue: {
    color: ink,
    fontSize: 40,
    lineHeight: 42,
    fontWeight: "900",
    letterSpacing: -1.6,
  },
  leadLabel: {
    marginTop: 4,
    color: "rgba(0,0,0,0.65)",
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "800",
  },
  stats: {
    marginTop: 12,
    flexDirection: "row",
    flexWrap: "wrap",
    rowGap: 12,
    columnGap: 24,
  },
  stat: {
    width: "45%",
  },
  statValue: {
    color: ink,
    fontSize: 22,
    lineHeight: 24,
    fontWeight: "900",
    letterSpacing: -0.66,
  },
  statLabel: {
    marginTop: 4,
    color: "rgba(0,0,0,0.6)",
    fontSize: 11,
    lineHeight: 13,
    fontWeight: "800",
  },
  subject: {
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 2,
    borderColor: ink,
  },
  subjectLabel: {
    color: "rgba(0,0,0,0.6)",
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "800",
  },
  subjectValue: {
    marginTop: 4,
    color: ink,
    fontSize: 22,
    lineHeight: 23,
    fontWeight: "900",
    letterSpacing: -0.55,
  },
  signature: {
    marginTop: 16,
    color: ink,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "900",
  },
});
