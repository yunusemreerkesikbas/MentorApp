"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.questProgressKey = questProgressKey;
exports.findNewlyCompletedQuests = findNewlyCompletedQuests;
exports.formatRewardSummary = formatRewardSummary;
function questProgressKey(quest) {
    return `${quest.id}:${quest.periodKey}`;
}
function findNewlyCompletedQuests(previous, next) {
    if (!previous)
        return [];
    const previousByKey = new Map(previous.map((quest) => [questProgressKey(quest), quest.completed]));
    return next.filter((quest) => quest.completed && previousByKey.get(questProgressKey(quest)) !== true);
}
function formatRewardSummary(quests, translate) {
    const totals = quests.reduce((acc, quest) => {
        if (quest.rewardUnit === "XP")
            acc.xp += quest.rewardAmount;
        if (quest.rewardUnit === "COIN")
            acc.coin += quest.rewardAmount;
        return acc;
    }, { xp: 0, coin: 0 });
    return [
        totals.xp > 0 ? translate("quest_reward_xp", { count: totals.xp }) : null,
        totals.coin > 0 ? translate("quest_reward_coin", { count: totals.coin }) : null,
    ]
        .filter(Boolean)
        .join(" · ");
}
//# sourceMappingURL=economy-quest-utils.js.map