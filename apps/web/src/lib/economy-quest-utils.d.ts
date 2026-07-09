import type { QuestProgressView } from "@mentor/types";
export declare function questProgressKey(quest: QuestProgressView): string;
export declare function findNewlyCompletedQuests(previous: QuestProgressView[] | null, next: QuestProgressView[]): QuestProgressView[];
type QuestRewardTranslate = (key: "quest_reward_xp" | "quest_reward_coin", values: {
    count: number;
}) => string;
export declare function formatRewardSummary(quests: QuestProgressView[], translate: QuestRewardTranslate): string;
export {};
//# sourceMappingURL=economy-quest-utils.d.ts.map