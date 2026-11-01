import type { QuestProgressView } from "@mentor/types";
import type { DailyQuestSignals } from "../../coaching/application/daily-quest-signal.service";
import { QUEST_CATALOG } from "../domain/quest.catalog";
import { resolveQuestCardCopy } from "../domain/quest-copy";
import {
  coinReward,
  isEconomyAction,
  progressKey,
  questPeriodKey,
  rewardUnitFor,
  questTarget,
  sourceCurrent,
  xpReward,
  type QuestConfig,
} from "./quest-progress";

interface QuestViewInput {
  signals: DailyQuestSignals;
  currentStreak: number;
  cfg: QuestConfig;
  rewardsEnabled: boolean;
  isPremium: boolean;
  rows: readonly { questId: string; periodKey: string; completedAt: Date }[];
  pendingRewards: readonly string[];
  t: (key: string, args?: Record<string, unknown>) => string;
}

export function toQuestViews({
  signals,
  currentStreak,
  cfg,
  rewardsEnabled,
  isPremium,
  rows,
  pendingRewards,
  t,
}: QuestViewInput): QuestProgressView[] {
  const byKey = new Map(
    rows.map((r) => [progressKey(r.questId, r.periodKey), r]),
  );
  // The goal quest only exists for users who chose a goal — no default target.
  const visible = QUEST_CATALOG.filter(
    (q) =>
      !cfg.disabledIds.has(q.id) &&
      (rewardsEnabled || !isEconomyAction(q)) &&
      rewardUnitFor(q, isPremium) !== null &&
      (q.id !== "daily.focus-goal-met" ||
        signals.dailyFocusGoalMinutes != null),
  );
  return visible.map((q) => {
    const periodKey = questPeriodKey(q, signals);
    const row = byKey.get(progressKey(q.id, periodKey));
    const rewardPending =
      rewardsEnabled &&
      !row &&
      pendingRewards.includes(progressKey(q.id, periodKey));
    const rewardUnit = rewardsEnabled ? (rewardUnitFor(q, isPremium) ?? "NONE") : "NONE";
    const rewardAmount =
      rewardUnit === "XP"
        ? xpReward(q, cfg)
        : rewardUnit === "COIN"
          ? coinReward(q, cfg)
          : 0;
    const hasTarget = q.progressTarget != null || q.targetConfigKey != null;
    const target = hasTarget ? questTarget(q, cfg.targets) : undefined;
    const copy = resolveQuestCardCopy(
      t,
      q.id,
      target != null ? { target } : {},
    );
    return {
      id: q.id,
      category: q.category,
      period: q.period,
      periodKey,
      type: q.type,
      title: copy.title,
      badgeLabel: copy.badgeLabel,
      action: rewardPending ? null : q.action,
      rewardUnit,
      rewardAmount,
      rewardCoin: rewardUnit === "COIN" ? rewardAmount : 0,
      progressCurrent:
        target != null
          ? row
            ? target
            : Math.min(sourceCurrent(q, signals, currentStreak), target)
          : undefined,
      progressTarget: target,
      completed: row !== undefined,
      completedAt: row?.completedAt.toISOString() ?? null,
      ...(rewardPending
        ? { rewardPendingMessage: t("questRewardPending") }
        : {}),
    };
  });
}
