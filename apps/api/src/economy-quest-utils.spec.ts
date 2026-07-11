import { describe, expect, it } from "vitest";
import type { QuestProgressView } from "@mentor/types";
import {
  findNewlyCompletedQuests,
  formatRewardSummary,
  questProgressKey,
} from "../../web/src/lib/economy-quest-utils";

const quest = (
  overrides: Partial<QuestProgressView> & Pick<QuestProgressView, "id" | "periodKey">,
): QuestProgressView => ({
  category: "daily_ritual",
  period: "daily",
  type: "daily_ritual",
  title: "Test quest",
  badgeLabel: "Odak",
  action: "study-session",
  rewardUnit: "XP",
  rewardAmount: 5,
  rewardCoin: 0,
  completed: false,
  completedAt: null,
  ...overrides,
});

describe("economy-quest-utils", () => {
  it("combines id and periodKey", () => {
    expect(questProgressKey(quest({ id: "daily.focus-session-completed", periodKey: "2026-07-10" }))).toBe(
      "daily.focus-session-completed:2026-07-10",
    );
  });

  it("returns quests that became completed since the previous snapshot", () => {
    const previous = [
      quest({ id: "daily.focus-session-completed", periodKey: "2026-07-10", completed: false }),
      quest({ id: "daily.mood-checkin", periodKey: "2026-07-10", completed: true }),
    ];
    const next = [
      quest({ id: "daily.focus-session-completed", periodKey: "2026-07-10", completed: true }),
      quest({ id: "daily.mood-checkin", periodKey: "2026-07-10", completed: true }),
    ];
    expect(findNewlyCompletedQuests(previous, next)).toHaveLength(1);
    expect(findNewlyCompletedQuests(previous, next)[0]!.id).toBe("daily.focus-session-completed");
  });

  it("returns empty when previous snapshot is missing", () => {
    const next = [quest({ id: "daily.focus-session-completed", periodKey: "2026-07-10", completed: true })];
    expect(findNewlyCompletedQuests(null, next)).toEqual([]);
  });

  it("sums XP and Coin rewards for the toast line", () => {
    const translate = (key: "quest_reward_xp" | "quest_reward_coin", values: { count: number }) =>
      key === "quest_reward_xp" ? `+${values.count} XP` : `+${values.count} Coin`;

    const summary = formatRewardSummary(
      [
        quest({ id: "daily.focus-session-completed", periodKey: "2026-07-10", completed: true, rewardAmount: 5 }),
        quest({ id: "onboarding.profile-setup", periodKey: "once", completed: true, rewardUnit: "COIN", rewardAmount: 10 }),
      ],
      translate,
    );

    expect(summary).toBe("+5 XP · +10 Coin");
  });
});
