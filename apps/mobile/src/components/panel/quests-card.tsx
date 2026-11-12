import { Pressable, StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { AltArrowRightIcon } from "@solar-icons/react-native/linear/alt-arrow-right";
import type { QuestProgressView, WeeklyChestView } from "@mentor/types";
import { art } from "../../lib/art.js";
import { mixHex } from "../../lib/layout.js";
import { useTranslations } from "../../providers/i18n-provider.js";
import { useThemeTokens } from "../../providers/theme-provider.js";
import { AppText } from "../ui/text.js";
import { chestCanStillFill, chestDaysLeft, chestLamps } from "./chest.js";
import { PanelCard, PanelCardTitle, ProgressLine } from "./primitives.js";
import { chestReward } from "./today-path.js";

/**
 * Today's ritual quests with their progress, and the weekly chest (the web's `DailyQuestsCard`).
 * The list only shows; "Tüm görevler" opens the full quest sheet.
 */
export function QuestsCard({
  quests,
  chest,
  onChestPress,
  onOpenAll,
}: {
  quests: QuestProgressView[];
  chest: WeeklyChestView | null;
  onChestPress: (chest: WeeklyChestView) => void;
  onOpenAll: () => void;
}) {
  const t = useTranslations("panel");
  const { palette } = useThemeTokens();
  const daily = quests.filter((quest) => quest.category === "daily_ritual");
  if (daily.length === 0 && !chest) return null;
  const done = daily.filter((quest) => quest.completed).length;

  return (
    <PanelCard style={styles.card}>
      <View style={styles.header}>
        <PanelCardTitle>{t("quests_title")}</PanelCardTitle>
        {daily.length > 0 ? (
          <AppText tabularNums style={[styles.progress, { color: palette.secondary }]}>
            {t("quests_progress", { done, total: daily.length })}
          </AppText>
        ) : null}
      </View>

      {daily.length > 0 ? (
        <View style={styles.list}>
          {daily.map((quest) => (
            <QuestLine key={quest.id} quest={quest} />
          ))}
        </View>
      ) : null}

      {chest ? <ChestRow chest={chest} onPress={() => onChestPress(chest)} /> : null}

      {quests.length > 0 ? (
        <Pressable accessibilityRole="button" onPress={onOpenAll} style={styles.openAll}>
          <AppText style={[styles.openAllLabel, { color: palette.playSelectedInk }]}>
            {t("quests_open_all")}
          </AppText>
          <AltArrowRightIcon size={16} color={palette.playSelectedInk} />
        </Pressable>
      ) : null}
    </PanelCard>
  );
}

function QuestLine({ quest }: { quest: QuestProgressView }) {
  const t = useTranslations("panel");
  const { palette } = useThemeTokens();
  const target = Math.max(quest.progressTarget ?? 1, 1);
  const current = quest.completed ? target : Math.min(quest.progressCurrent ?? 0, target);
  const reward =
    quest.rewardUnit === "XP"
      ? t("quest_reward_xp", { count: quest.rewardAmount })
      : quest.rewardUnit === "COIN"
        ? t("quest_reward_coin", { count: quest.rewardAmount })
        : null;

  return (
    <View style={styles.quest}>
      <View style={styles.questBody}>
        <View style={styles.questHead}>
          <AppText numberOfLines={1} style={styles.questTitle}>
            {quest.title}
          </AppText>
          {target > 1 && !quest.completed ? (
            <AppText tabularNums style={[styles.questCount, { color: palette.secondary }]}>
              {current}/{target}
            </AppText>
          ) : null}
        </View>
        <ProgressLine label={quest.title} value={current} max={target} complete={quest.completed} />
      </View>
      {reward ? (
        <AppText
          style={[
            styles.reward,
            { color: quest.completed ? palette.success : palette.secondary },
          ]}
        >
          {reward}
        </AppText>
      ) : null}
    </View>
  );
}

/** The weekly chest's row; the whole row is one button. */
function ChestRow({ chest, onPress }: { chest: WeeklyChestView; onPress: () => void }) {
  const t = useTranslations("panel");
  const { palette } = useThemeTokens();
  const gold = palette.streakCore;
  const reward = chestReward(chest, t);
  const lamps = chestLamps(chest);

  if (chest.state === "READY") {
    return (
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        style={[
          styles.chestRow,
          styles.chestReady,
          { borderColor: gold, backgroundColor: mixHex(gold, palette.surface, 0.42) },
        ]}
      >
        <Image source={art.chestClosed} style={styles.chestArtReady} contentFit="contain" />
        <View style={styles.chestText}>
          <AppText style={styles.chestTitleReady}>
            {chest.carriedOver
              ? t("chest_carried_title")
              : t("chest_card_ready_title", { target: chest.target })}
          </AppText>
          <AppText style={[styles.chestBody, { color: palette.secondary }]}>
            {t("chest_card_ready_body")}
          </AppText>
        </View>
        <View
          style={[
            styles.goldPill,
            { backgroundColor: gold, borderBottomColor: mixHex(palette.star, palette.main, 0.75) },
          ]}
        >
          <AppText style={[styles.goldPillText, { color: mixHex(palette.star, palette.main, 0.25) }]}>
            {t("chest_open")}
          </AppText>
        </View>
      </Pressable>
    );
  }

  if (chest.state === "OPENED") {
    return (
      <View style={[styles.chestRow, { backgroundColor: mixHex(gold, palette.surface, 0.18) }]}>
        <Image source={art.chestOpen} style={styles.chestArt} contentFit="contain" />
        <View style={styles.chestText}>
          <AppText style={styles.chestTitle}>{t("chest_card_opened_title")}</AppText>
          <AppText style={[styles.chestBody, { color: palette.secondary }]}>
            {t("chest_card_opened_body")}
          </AppText>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.chestRow, { backgroundColor: mixHex(gold, palette.surface, 0.24) }]}>
      <Image source={art.chestClosed} style={styles.chestArt} contentFit="contain" />
      <View style={styles.chestText}>
        <AppText style={styles.chestTitle}>{t("chest_title")}</AppText>
        <View style={styles.lamps}>
          {lamps.map((lit, index) => (
            <View
              key={index}
              style={[
                styles.lamp,
                { backgroundColor: lit ? mixHex(palette.star, palette.streak, 0.6) : palette.border },
              ]}
            />
          ))}
          <AppText tabularNums style={[styles.lampText, { color: palette.secondary }]}>
            {chestCanStillFill(chest)
              ? t("chest_days_left", { left: chestDaysLeft(chest) })
              : t("chest_days_left_missed")}
          </AppText>
        </View>
        {reward ? null : (
          <AppText style={[styles.lampText, { color: palette.secondary }]}>
            {t("chest_story_inside")}
          </AppText>
        )}
      </View>
      {reward ? (
        <AppText tabularNums style={[styles.reward, { color: palette.secondary }]}>
          {reward}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 16,
  },
  header: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 12,
  },
  progress: {
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "700",
  },
  list: {
    gap: 14,
  },
  quest: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  questBody: {
    flex: 1,
    minWidth: 0,
    gap: 6,
  },
  questHead: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 8,
  },
  questTitle: {
    flexShrink: 1,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: "800",
  },
  questCount: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "700",
  },
  reward: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "800",
  },
  chestRow: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  chestReady: {
    borderWidth: 2,
  },
  chestArt: {
    width: 40,
    height: 40,
  },
  chestArtReady: {
    width: 48,
    height: 48,
  },
  chestText: {
    flex: 1,
    minWidth: 0,
  },
  chestTitle: {
    fontSize: 14,
    lineHeight: 19,
    fontWeight: "800",
  },
  chestTitleReady: {
    fontSize: 14,
    lineHeight: 19,
    fontWeight: "900",
  },
  chestBody: {
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "700",
  },
  lamps: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
  },
  lamp: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  lampText: {
    marginLeft: 4,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "700",
  },
  openAll: {
    alignSelf: "flex-start",
    minHeight: 44,
    marginBottom: -8,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  openAllLabel: {
    fontSize: 14,
    lineHeight: 19,
    fontWeight: "800",
  },
  goldPill: {
    borderRadius: 9999,
    borderBottomWidth: 3,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  goldPillText: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "900",
  },
});
