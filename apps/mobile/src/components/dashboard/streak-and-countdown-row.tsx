import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { formatWeekdayShort } from "@mentor/core";
import type {
  CountdownDto,
  StreakRescueView,
  StreakSummaryDto,
} from "@mentor/types";
import { ApiClientError } from "@mentor/api-client";
import { purchaseStreakRescue } from "../../lib/coaching-api.js";
import { haptics } from "../../lib/haptics.js";
import { useLocale, useTranslations } from "../../providers/i18n-provider.js";
import { useThemeTokens } from "../../providers/theme-provider.js";
import { AppText, Button, Card, Chip } from "../ui/index.js";

export interface StreakAndCountdownRowProps {
  streak: StreakSummaryDto;
  countdown: CountdownDto | null;
  streakRescue: StreakRescueView | null;
  onRescueCompleted: () => void;
}

export function StreakAndCountdownRow({
  streak,
  countdown,
  streakRescue,
  onRescueCompleted,
}: StreakAndCountdownRowProps) {
  const { locale } = useLocale();
  const t = useTranslations("dashboard");
  const tCommon = useTranslations("common");
  const { palette, radii, space } = useThemeTokens();
  const [rescuing, setRescuing] = useState(false);
  const [rescueFeedback, setRescueFeedback] = useState<string | null>(null);
  const [rescueError, setRescueError] = useState<string | null>(null);

  const handleRescue = async () => {
    if (rescuing || !streakRescue?.canAfford) return;
    setRescuing(true);
    setRescueError(null);
    try {
      await purchaseStreakRescue();
      haptics.success();
      setRescueFeedback(t("rescue_success"));
      onRescueCompleted();
    } catch (err) {
      setRescueError(
        err instanceof ApiClientError || err instanceof Error
          ? err.message
          : t("rescue_cta", { cost: streakRescue.cost }),
      );
    } finally {
      setRescuing(false);
    }
  };

  return (
    <View style={{ gap: space.md }}>
      <View style={styles.splitRow}>
        {/* Streak Card */}
        <Card style={[styles.halfCard, { gap: space.sm }]}>
          <View style={styles.topRow}>
            <AppText variant="caption" tone="secondary">
              {t("streak_title")}
            </AppText>
            {streak.freezeTokens > 0 ? (
              <Chip
                label={t("streak_freeze", { count: streak.freezeTokens })}
                tone="warning"
              />
            ) : null}
          </View>
          <AppText variant="title" tabularNums>
            🔥 {t("streak_days", { count: streak.currentStreak })}
          </AppText>
          <AppText variant="micro" tone="muted" tabularNums>
            {t("streak_longest", { count: streak.longestStreak })}
          </AppText>

          {streak.week.length > 0 ? (
            <View style={styles.weekRow}>
              {streak.week.map((day) => {
                const bg = day.active
                  ? palette.ctaPlayBg
                  : day.frozen
                    ? palette.warningBg
                    : palette.surfaceAlt;
                const border = day.active
                  ? palette.ctaPlayEdge
                  : day.frozen
                    ? palette.warning
                    : palette.border;
                const ink = day.active
                  ? palette.ctaPlayInk
                  : day.frozen
                    ? palette.warning
                    : palette.muted;
                return (
                  <View
                    key={day.date}
                    style={[
                      styles.dayDot,
                      {
                        backgroundColor: bg,
                        borderColor: border,
                        borderRadius: radii.pill,
                      },
                    ]}
                  >
                    <AppText variant="micro" style={{ color: ink }}>
                      {formatWeekdayShort(day.date, locale).slice(0, 2)}
                    </AppText>
                  </View>
                );
              })}
            </View>
          ) : null}
        </Card>

        {/* Official Countdown Data Card (Guardrail §4 #1 — verbatim server values) */}
        <Card style={[styles.halfCard, { gap: space.sm }]}>
          <AppText variant="caption" tone="secondary">
            {countdown
              ? `${countdown.examName} · ${t("countdown_title")}`
              : t("countdown_title")}
          </AppText>
          {countdown ? (
            <>
              <AppText variant="title" tabularNums>
                {countdown.daysRemaining <= 0
                  ? t("countdown_today")
                  : t("countdown_days", { days: countdown.daysRemaining })}
              </AppText>
              <AppText variant="caption" tone="main">
                {countdown.examDateLabel}
              </AppText>
              <AppText variant="micro" tone="muted">
                {t("countdown_source", { source: countdown.source })}
              </AppText>
            </>
          ) : (
            <AppText variant="caption" tone="muted">
              {t("countdown_empty")}
            </AppText>
          )}
        </Card>
      </View>

      {/* Streak Rescue Banner (Companion register — calm, zero guilt) */}
      {streakRescue?.eligible ? (
        <Card variant="alt" style={{ gap: space.sm }}>
          <AppText variant="cardTitle">{t("rescue_title")}</AppText>
          <AppText variant="body" tone="secondary">
            {streakRescue.canAfford
              ? t("rescue_body", { cost: streakRescue.cost })
              : t("rescue_insufficient", {
                  cost: streakRescue.cost,
                })}
          </AppText>
          {rescueError ? (
            <AppText variant="caption" tone="danger">
              {rescueError}
            </AppText>
          ) : null}
          {streakRescue.canAfford ? (
            <Button
              label={
                rescuing
                  ? tCommon("loading")
                  : t("rescue_cta", { cost: streakRescue.cost })
              }
              onPress={() => void handleRescue()}
              disabled={rescuing}
              variant="primary"
            />
          ) : null}
        </Card>
      ) : rescueFeedback ? (
        <Card variant="alt">
          <AppText variant="body" tone="success">
            {rescueFeedback}
          </AppText>
        </Card>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  splitRow: {
    flexDirection: "row",
    gap: 12,
  },
  halfCard: {
    flex: 1,
    justifyContent: "space-between",
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 6,
  },
  weekRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 4,
    marginTop: 4,
  },
  dayDot: {
    width: 26,
    height: 26,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
