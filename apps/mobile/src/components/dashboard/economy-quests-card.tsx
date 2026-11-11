import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { EconomyBalance, QuestProgressView } from "@mentor/types";
import {
  fetchNotebookSlotQuote,
  purchaseNotebookSlot,
} from "../../lib/coaching-api.js";
import { haptics } from "../../lib/haptics.js";
import { useTranslations } from "../../providers/i18n-provider.js";
import { useThemeTokens } from "../../providers/theme-provider.js";
import { AppText, Button, Card, Chip } from "../ui/index.js";

export interface EconomyQuestsCardProps {
  balance: EconomyBalance | null;
  quests: QuestProgressView[];
}

export function EconomyQuestsCard({ balance, quests }: EconomyQuestsCardProps) {
  const queryClient = useQueryClient();
  const t = useTranslations("dashboard");
  const { palette, radii, space } = useThemeTokens();
  const [slotUnlockedBanner, setSlotUnlockedBanner] = useState(false);

  const slotQuery = useQuery({
    queryKey: ["economy", "notebook-slots"],
    queryFn: fetchNotebookSlotQuote,
  });

  const buySlotMutation = useMutation({
    mutationFn: () => {
      const slot = slotQuery.data;
      if (!slot) throw new Error("Slot unavailable");
      const idempotencyKey = `slot-${slot.purchasedSlots}-${Date.now()}`;
      return purchaseNotebookSlot({
        expectedCost: slot.cost,
        expectedPurchasedSlots: slot.purchasedSlots,
        idempotencyKey,
      });
    },
    onSuccess: async () => {
      haptics.success();
      setSlotUnlockedBanner(true);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["economy", "notebook-slots"] }),
        queryClient.invalidateQueries({ queryKey: ["economy", "balance"] }),
      ]);
    },
  });

  const dailyAndWeekly = quests.filter(
    (q) => q.period === "daily" || q.period === "weekly",
  );

  if (!balance && dailyAndWeekly.length === 0) {
    return null;
  }

  return (
    <Card style={{ gap: space.md }}>
      <View style={styles.headerRow}>
        <AppText variant="cardTitle">{t("quests_title")}</AppText>
        {balance ? (
          <View style={styles.balanceRow}>
            <Chip
              label={t("level_badge", { tier: balance.level.tier })}
              tone="success"
            />
            <Chip
              label={t("xp_label", { xp: balance.xp })}
              tone="default"
            />
            <Chip
              label={`🪙 ${t("coin_label", { coin: balance.coinConfirmed })}`}
              tone="warning"
            />
          </View>
        ) : null}
      </View>

      {dailyAndWeekly.length === 0 ? null : (
        <View style={{ gap: space.sm }}>
          {dailyAndWeekly.slice(0, 5).map((quest) => {
            const rewardLabel =
              quest.rewardUnit === "COIN" && quest.rewardAmount > 0
                ? `+${quest.rewardAmount} Coin`
                : quest.rewardUnit === "XP" && quest.rewardAmount > 0
                  ? `+${quest.rewardAmount} XP`
                  : quest.badgeLabel;

            const hasProgress =
              quest.progressTarget != null &&
              quest.progressTarget > 1 &&
              quest.progressCurrent != null;

            return (
              <View
                key={quest.id}
                style={[
                  styles.questRow,
                  {
                    backgroundColor: quest.completed
                      ? palette.surfaceAlt
                      : palette.surface,
                    borderColor: palette.border,
                    borderRadius: radii.inner,
                    padding: space.md,
                  },
                ]}
              >
                <View style={{ flex: 1, gap: 4 }}>
                  <AppText
                    variant="body"
                    tone={quest.completed ? "muted" : "main"}
                  >
                    {quest.completed ? "✓ " : ""}
                    {quest.title}
                  </AppText>
                  {hasProgress ? (
                    <AppText variant="micro" tone="muted" tabularNums>
                      {quest.progressCurrent} / {quest.progressTarget}
                    </AppText>
                  ) : null}
                  {quest.rewardPendingMessage ? (
                    <AppText variant="micro" tone="warning">
                      {quest.rewardPendingMessage}
                    </AppText>
                  ) : null}
                </View>

                <Chip
                  label={quest.completed ? t("quest_done") : rewardLabel}
                  tone={quest.completed ? "success" : "default"}
                />
              </View>
            );
          })}
        </View>
      )}

      {slotQuery.data && !slotQuery.data.premium ? (
        <View
          style={[
            styles.questRow,
            {
              backgroundColor: palette.surfaceAlt,
              borderColor: palette.border,
              borderRadius: radii.inner,
              padding: space.md,
            },
          ]}
        >
          <View style={{ flex: 1, gap: 4 }}>
            <AppText variant="body">
              {t("notebook_slot_title", {
                owned: slotQuery.data.purchasedSlots,
                limit: slotQuery.data.maxPurchasableSlots,
              })}
            </AppText>
            {slotUnlockedBanner ? (
              <AppText variant="micro" tone="success">
                {t("notebook_slot_unlocked")}
              </AppText>
            ) : null}
          </View>
          {slotQuery.data.canPurchase ? (
            <Button
              label={t("notebook_slot_cta", { cost: slotQuery.data.cost })}
              variant="secondary"
              loading={buySlotMutation.isPending}
              onPress={() => buySlotMutation.mutate()}
            />
          ) : (
            <Chip
              label={`${slotQuery.data.cost} Coin`}
              tone="default"
            />
          )}
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 8,
  },
  balanceRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
  },
  questRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    gap: 10,
  },
});
