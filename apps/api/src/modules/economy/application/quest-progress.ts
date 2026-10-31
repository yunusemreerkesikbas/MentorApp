import type { DailyQuestSignals } from "../../coaching/application/daily-quest-signal.service";
import { QuestType, type QuestDef } from "../domain/quest.catalog";

export interface QuestConfig {
  onboardingRewardCoin: number;
  dailyRewardXp: number;
  streakMilestoneRewardXp: number;
  effortMilestoneRewardXp: number;
  weeklyRitualRewardXp: number;
  /** The recurring coin faucet's payout (weekly effort allowance). */
  weeklyAllowanceRewardCoin: number;
  /** targetConfigKey → resolved value (admin-tunable weekly targets). */
  targets: Map<string, number>;
  disabledIds: Set<string>;
}

export function progressKey(questId: string, periodKey: string): string {
  return `${questId}:${periodKey}`;
}

/** The quest's completion target: config-resolved when `targetConfigKey` is set. */
export function questTarget(q: QuestDef, targets: Map<string, number>): number {
  const fromConfig = q.targetConfigKey
    ? targets.get(q.targetConfigKey)
    : undefined;
  return fromConfig ?? q.progressTarget ?? Number.POSITIVE_INFINITY;
}

export function sourceCurrent(
  q: QuestDef,
  signals: DailyQuestSignals,
  currentStreak: number,
): number {
  switch (q.progressSource) {
    case "streak":
      return currentStreak;
    case "completed_focus_sessions":
      return signals.completedFocusSessions;
    case "completed_plan_tasks":
      return signals.completedPlanTasks;
    case "weekly_focus_sessions":
      return signals.weeklyCompletedFocusSessions;
    case "weekly_plan_tasks":
      return signals.weeklyCompletedPlanTasks;
    case "weekly_active_days":
      return signals.weeklyActiveDays;
    default:
      return 0;
  }
}

export function xpReward(q: QuestDef, cfg: QuestConfig): number {
  if (q.type === QuestType.WEEKLY_RITUAL) return cfg.weeklyRitualRewardXp;
  if (q.type !== QuestType.MILESTONE) return cfg.dailyRewardXp;
  return q.progressSource === "streak"
    ? cfg.streakMilestoneRewardXp
    : cfg.effortMilestoneRewardXp;
}

/** Symmetric to `xpReward` — without it every COIN quest would silently pay the onboarding amount. */
export function coinReward(q: QuestDef, cfg: QuestConfig): number {
  return q.type === QuestType.WEEKLY_RITUAL
    ? cfg.weeklyAllowanceRewardCoin
    : cfg.onboardingRewardCoin;
}

export function isEconomyAction(quest: QuestDef): boolean {
  return quest.action === "subscription" || quest.action === "invite";
}
