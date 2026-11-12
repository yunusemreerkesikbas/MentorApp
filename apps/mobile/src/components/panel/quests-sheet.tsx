import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from "react-native";
import { AltArrowRightIcon } from "@solar-icons/react-native/linear/alt-arrow-right";
import type { QuestProgressView } from "@mentor/types";
import { useTranslations } from "../../providers/i18n-provider.js";
import { useThemeTokens } from "../../providers/theme-provider.js";
import { AppText } from "../ui/text.js";
import { BottomSheet, ProgressLine } from "./primitives.js";

type Section = "quests_section_daily" | "quests_section_weekly" | "quests_section_milestone";

/** Where a quest's step can be taken from the phone; the other actions only show progress. */
export type QuestDestination = "plan" | "study-session" | "invite";

const DESTINATIONS: Partial<Record<NonNullable<QuestProgressView["action"]>, QuestDestination>> = {
  plan: "plan",
  "study-session": "study-session",
  invite: "invite",
};

/**
 * Every quest in one sheet (the web's `EconomyQuestsCard` behind "Tüm görevler"), grouped the way
 * the web's tabs are. Subscription quests are left out with the other Premium calls, until the app
 * can sell Premium itself; the rewarded-ad offer is web-only.
 */
export function QuestsSheet({
  visible,
  quests,
  onClose,
  onGo,
}: {
  visible: boolean;
  quests: QuestProgressView[];
  onClose: () => void;
  onGo: (destination: QuestDestination) => void;
}) {
  const t = useTranslations("panel");
  const { height } = useWindowDimensions();
  const shown = quests.filter((quest) => quest.action !== "subscription");
  const sections: { label: Section; quests: QuestProgressView[] }[] = [
    {
      label: "quests_section_daily" as const,
      quests: shown.filter((quest) => quest.category === "daily_ritual"),
    },
    {
      label: "quests_section_weekly" as const,
      quests: shown.filter((quest) => quest.category === "weekly_ritual"),
    },
    {
      label: "quests_section_milestone" as const,
      quests: shown.filter(
        (quest) => quest.category === "milestone" || quest.category === "onboarding",
      ),
    },
  ].filter((section) => section.quests.length > 0);

  return (
    <BottomSheet visible={visible} onClose={onClose} closeLabel={t("sheet_close")}>
      <AppText accessibilityRole="header" style={styles.title}>
        {t("quests_sheet_title")}
      </AppText>
      <ScrollView style={{ maxHeight: height * 0.62 }} contentContainerStyle={styles.list}>
        {sections.map((section) => (
          <View key={section.label} style={styles.section}>
            <SectionLabel>{t(section.label)}</SectionLabel>
            {section.quests.map((quest) => (
              <QuestRow
                key={quest.id}
                quest={quest}
                onGo={(destination) => {
                  onClose();
                  onGo(destination);
                }}
              />
            ))}
          </View>
        ))}
      </ScrollView>
    </BottomSheet>
  );
}

function SectionLabel({ children }: { children: string }) {
  const { palette } = useThemeTokens();
  return <AppText style={[styles.sectionLabel, { color: palette.secondary }]}>{children}</AppText>;
}

function QuestRow({
  quest,
  onGo,
}: {
  quest: QuestProgressView;
  onGo: (destination: QuestDestination) => void;
}) {
  const t = useTranslations("panel");
  const { palette } = useThemeTokens();
  const target = Math.max(quest.progressTarget ?? 1, 1);
  const current = quest.completed ? target : Math.min(quest.progressCurrent ?? 0, target);
  const destination = !quest.completed && quest.action ? DESTINATIONS[quest.action] : undefined;
  const reward = quest.completed
    ? t("quest_completed")
    : quest.rewardUnit === "XP"
      ? t("quest_reward_xp", { count: quest.rewardAmount })
      : quest.rewardUnit === "COIN"
        ? t("quest_reward_coin", { count: quest.rewardAmount })
        : null;

  const body = (
    <>
      <View style={styles.rowBody}>
        <View style={styles.rowHead}>
          <AppText numberOfLines={2} style={styles.rowTitle}>
            {quest.title}
          </AppText>
          {target > 1 && !quest.completed ? (
            <AppText tabularNums style={[styles.rowCount, { color: palette.secondary }]}>
              {current}/{target}
            </AppText>
          ) : null}
        </View>
        <ProgressLine label={quest.title} value={current} max={target} complete={quest.completed} />
        {reward ? (
          <AppText
            style={[
              styles.rowReward,
              { color: quest.completed ? palette.success : palette.secondary },
            ]}
          >
            {reward}
          </AppText>
        ) : null}
      </View>
      {destination ? <AltArrowRightIcon size={18} color={palette.secondary} /> : null}
    </>
  );

  return destination ? (
    <Pressable
      accessibilityRole="button"
      onPress={() => onGo(destination)}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: pressed ? palette.surfaceHover : palette.surfaceAlt },
      ]}
    >
      {body}
    </Pressable>
  ) : (
    <View style={[styles.row, { backgroundColor: palette.surfaceAlt }]}>{body}</View>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 20,
    lineHeight: 27,
    fontWeight: "800",
    paddingHorizontal: 4,
    paddingBottom: 4,
  },
  list: {
    gap: 16,
    paddingBottom: 4,
  },
  section: {
    gap: 8,
  },
  sectionLabel: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "800",
    paddingHorizontal: 4,
  },
  row: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  rowBody: {
    flex: 1,
    minWidth: 0,
    gap: 6,
  },
  rowHead: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 8,
  },
  rowTitle: {
    flexShrink: 1,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: "800",
  },
  rowCount: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "700",
  },
  rowReward: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "800",
  },
});
