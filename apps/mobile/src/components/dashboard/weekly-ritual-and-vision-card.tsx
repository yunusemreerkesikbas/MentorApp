import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchVision,
  fetchWeeklyChest,
  fetchWeeklyReview,
  openWeeklyChest,
  upsertVision,
} from "../../lib/coaching-api.js";
import { haptics } from "../../lib/haptics.js";
import { useTranslations } from "../../providers/i18n-provider.js";
import { useThemeTokens } from "../../providers/theme-provider.js";
import { AppText, Button, Card, Chip, TextField } from "../ui/index.js";

export function WeeklyRitualAndVisionCard() {
  const queryClient = useQueryClient();
  const { palette, radii, space } = useThemeTokens();
  const t = useTranslations("dashboard");

  const [editingVision, setEditingVision] = useState(false);
  const [goalTitle, setGoalTitle] = useState("");
  const [targetCity, setTargetCity] = useState("");
  const [motivation, setMotivation] = useState("");
  const [savedBanner, setSavedBanner] = useState(false);

  const chestQuery = useQuery({
    queryKey: ["economy", "weekly-chest"],
    queryFn: fetchWeeklyChest,
  });

  const visionQuery = useQuery({
    queryKey: ["coaching", "vision"],
    queryFn: fetchVision,
  });

  const weeklyReviewQuery = useQuery({
    queryKey: ["coaching", "weekly-review"],
    queryFn: fetchWeeklyReview,
  });

  const openChestMutation = useMutation({
    mutationFn: (periodKey: string) => openWeeklyChest(periodKey),
    onSuccess: async () => {
      haptics.success();
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["economy", "weekly-chest"] }),
        queryClient.invalidateQueries({ queryKey: ["economy", "balance"] }),
      ]);
    },
  });

  const saveVisionMutation = useMutation({
    mutationFn: () =>
      upsertVision({
        goalTitle: goalTitle.trim(),
        targetCity: targetCity.trim() || null,
        motivation: motivation.trim() || null,
      }),
    onSuccess: async () => {
      haptics.success();
      setEditingVision(false);
      setSavedBanner(true);
      await queryClient.invalidateQueries({ queryKey: ["coaching", "vision"] });
    },
  });

  const chest = chestQuery.data;
  const vision = visionQuery.data;
  const review = weeklyReviewQuery.data;

  const startEditingVision = () => {
    setGoalTitle(vision?.goalTitle ?? "");
    setTargetCity(
      vision?.targetNames.cityName ?? vision?.targetCity ?? "",
    );
    setMotivation(vision?.motivation ?? "");
    setSavedBanner(false);
    setEditingVision(true);
  };

  return (
    <View style={{ gap: space.lg }}>
      {/* Weekly Effort Chest */}
      {chest ? (
        <Card style={{ gap: space.sm }}>
          <View style={styles.rowBetween}>
            <AppText variant="sectionHeading">
              {t("weekly_chest_title")}
            </AppText>
            {chest.reward ? (
              <Chip
                label={`+${chest.reward.amount} ${chest.reward.unit}`}
                selected={chest.state === "READY"}
              />
            ) : null}
          </View>

          <AppText variant="body" tone="secondary">
            {t("weekly_chest_progress", {
              current: chest.current,
              target: chest.target,
            })}
          </AppText>

          {chest.state === "READY" ? (
            <View style={{ gap: space.sm }}>
              <AppText variant="caption" tone="accent">
                {t("weekly_chest_ready_desc")}
              </AppText>
              <Button
                label={t("weekly_chest_open_cta")}
                loading={openChestMutation.isPending}
                onPress={() => openChestMutation.mutate(chest.periodKey)}
              />
            </View>
          ) : null}

          {chest.state === "OPENED" && chest.summary ? (
            <AppText variant="caption" tone="success">
              {t("weekly_chest_opened_desc", {
                days: chest.summary.activeDays,
                minutes: chest.summary.focusMinutes,
              })}
            </AppText>
          ) : null}
        </Card>
      ) : null}

      {/* Vision & Goal Board */}
      <Card style={{ gap: space.sm }}>
        <View style={styles.rowBetween}>
          <AppText variant="sectionHeading">{t("vision_title")}</AppText>
          {!editingVision ? (
            <Chip
              label={vision ? "Düzenle" : "Hedef Belirle"}
              onPress={startEditingVision}
            />
          ) : null}
        </View>

        {savedBanner ? (
          <AppText variant="caption" tone="success">
            {t("vision_saved")}
          </AppText>
        ) : null}

        {editingVision ? (
          <View style={{ gap: space.sm }}>
            <TextField
              label={t("vision_goal_label")}
              placeholder={t("vision_goal_placeholder")}
              value={goalTitle}
              onChangeText={setGoalTitle}
            />
            <TextField
              label={t("vision_city_label")}
              placeholder={t("vision_city_placeholder")}
              value={targetCity}
              onChangeText={setTargetCity}
            />
            <TextField
              label={t("vision_motivation_label")}
              placeholder={t("vision_motivation_placeholder")}
              value={motivation}
              onChangeText={setMotivation}
            />
            <View style={styles.rowBetween}>
              <Chip
                label="Vazgeç"
                onPress={() => setEditingVision(false)}
              />
              <Button
                label={t("vision_save_cta")}
                disabled={goalTitle.trim().length < 2}
                loading={saveVisionMutation.isPending}
                onPress={() => saveVisionMutation.mutate()}
              />
            </View>
          </View>
        ) : vision ? (
          <View style={{ gap: 8 }}>
            <AppText variant="cardTitle">{vision.goalTitle}</AppText>
            {vision.targetNames.cityName ||
            vision.targetCity ||
            vision.targetNames.universityName ||
            vision.targetNames.titleName ? (
              <View style={styles.chipWrap}>
                {vision.targetNames.cityName || vision.targetCity ? (
                  <Chip
                    label={
                      vision.targetNames.cityName ?? vision.targetCity ?? ""
                    }
                  />
                ) : null}
                {vision.targetNames.universityName ? (
                  <Chip label={vision.targetNames.universityName} />
                ) : null}
                {vision.targetNames.titleName ? (
                  <Chip label={vision.targetNames.titleName} />
                ) : null}
              </View>
            ) : null}

            {vision.motivation ? (
              <AppText variant="body" tone="secondary">
                “{vision.motivation}”
              </AppText>
            ) : null}

            {vision.aiNote ? (
              <View
                style={{
                  padding: space.sm,
                  borderRadius: radii.inner,
                  backgroundColor: palette.surfaceAlt,
                  gap: 4,
                }}
              >
                <AppText variant="micro" tone="coach">
                  {t("vision_puhu_note_label")}
                </AppText>
                <AppText variant="caption" tone="secondary">
                  {vision.aiNote}
                </AppText>
              </View>
            ) : null}
          </View>
        ) : (
          <AppText variant="body" tone="secondary">
            {t("vision_empty_desc")}
          </AppText>
        )}
      </Card>

      {/* Weekly Rhythm Recap (Mentor Wrapped) */}
      {review && review.recap.status !== "EMPTY" ? (
        <Card style={{ gap: space.sm }}>
          <View style={styles.rowBetween}>
            <AppText variant="sectionHeading">
              {t("weekly_recap_title")}
            </AppText>
            {review.recap.weeklyTitle ? (
              <Chip label={review.recap.weeklyTitle.label} selected />
            ) : null}
          </View>

          <AppText variant="caption" tone="secondary">
            {t("weekly_recap_summary", {
              days: review.rhythm.activeDays,
              minutes: review.rhythm.focusMinutes,
              tasks: review.plan.completedTaskCount,
            })}
          </AppText>

          {review.highlights.map((hl, idx) => (
            <AppText key={idx} variant="body">
              • {hl.message}
            </AppText>
          ))}

          {review.recap.closingMessage ? (
            <AppText variant="caption" tone="coach">
              {review.recap.closingMessage}
            </AppText>
          ) : null}
        </Card>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  chipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
});
