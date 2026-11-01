import type { ConfigRegistryService } from "../../../common/config/config-registry.service";
import type { QuestConfig } from "./quest-progress";

/** All quest-related config in one batch (rewards, weekly targets, kill-switch list). */
export async function readQuestConfig(
  config: ConfigRegistryService,
): Promise<QuestConfig> {
  const [
    onboardingRewardCoin,
    dailyRewardXp,
    streakMilestoneRewardXp,
    effortMilestoneRewardXp,
    weeklyRitualRewardXp,
    weeklyAllowanceRewardCoin,
    dailyActiveRewardCoin,
    weeklyFocusTarget,
    weeklyPlanTarget,
    weeklyAllowanceTarget,
    disabledCsv,
  ] = await Promise.all([
    config.get("economy.quest.onboarding_reward_coin"),
    config.get("economy.quest.daily_ritual_reward_xp"),
    config.get("economy.quest.streak_milestone_reward_xp"),
    config.get("economy.quest.effort_milestone_reward_xp"),
    config.get("economy.quest.weekly_ritual_reward_xp"),
    config.get("economy.quest.weekly_allowance_reward_coin"),
    config.get("economy.quest.daily_active_reward_coin"),
    config.get("economy.quest.weekly_focus_sessions_target"),
    config.get("economy.quest.weekly_plan_tasks_target"),
    config.get("economy.quest.weekly_allowance_active_days_target"),
    config.get("economy.quest.disabled_ids"),
  ]);
  return {
    onboardingRewardCoin,
    dailyRewardXp,
    streakMilestoneRewardXp,
    effortMilestoneRewardXp,
    weeklyRitualRewardXp,
    weeklyAllowanceRewardCoin,
    dailyActiveRewardCoin,
    targets: new Map([
      ["economy.quest.weekly_focus_sessions_target", weeklyFocusTarget],
      ["economy.quest.weekly_plan_tasks_target", weeklyPlanTarget],
      [
        "economy.quest.weekly_allowance_active_days_target",
        weeklyAllowanceTarget,
      ],
    ]),
    disabledIds: new Set(
      disabledCsv
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  };
}
