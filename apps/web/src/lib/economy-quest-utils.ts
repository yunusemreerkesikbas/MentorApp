import type { QuestProgressView } from "@mentor/types";

export function questProgressKey(quest: QuestProgressView): string {
  return `${quest.id}:${quest.periodKey}`;
}

export function findNewlyCompletedQuests(
  previous: QuestProgressView[] | null,
  next: QuestProgressView[],
): QuestProgressView[] {
  if (!previous) return [];
  const previousByKey = new Map(
    previous.map((quest) => [questProgressKey(quest), quest.completed]),
  );
  return next.filter(
    (quest) => quest.completed && previousByKey.get(questProgressKey(quest)) !== true,
  );
}

type QuestRewardTranslate = (
  key: "quest_reward_xp" | "quest_reward_coin",
  values: { count: number },
) => string;

export function formatRewardSummary(
  quests: QuestProgressView[],
  translate: QuestRewardTranslate,
): string {
  const totals = quests.reduce(
    (acc, quest) => {
      if (quest.rewardUnit === "XP") acc.xp += quest.rewardAmount;
      if (quest.rewardUnit === "COIN") acc.coin += quest.rewardAmount;
      return acc;
    },
    { xp: 0, coin: 0 },
  );
  return [
    totals.xp > 0 ? translate("quest_reward_xp", { count: totals.xp }) : null,
    totals.coin > 0 ? translate("quest_reward_coin", { count: totals.coin }) : null,
  ]
    .filter(Boolean)
    .join(" · ");
}
