import type {
  QuestAction,
  QuestCategory,
  QuestPeriod,
  QuestRewardUnit,
} from "@mentor/types";
import { STREAK_MILESTONES } from "@mentor/core";

/**
 * Static quest catalog (§3 light economy). The single source of truth for quest definitions;
 * per-user completion lives in `user_quest_progress`, reward amounts come from the config registry.
 * Quest ids are STABLE — they key the ledger refType/reason and progress rows.
 * Student-facing title / badge / ledgerTitle live in `economy.json` `quests.*` (companion register).
 */
export const QuestType = {
  ONBOARDING: "onboarding",
  DAILY_RITUAL: "daily_ritual",
  WEEKLY_RITUAL: "weekly_ritual",
  MILESTONE: "milestone",
} as const;
export type QuestType = (typeof QuestType)[keyof typeof QuestType];
export type QuestProgressSource =
  | "streak"
  | "completed_focus_sessions"
  | "completed_plan_tasks"
  | "weekly_focus_sessions"
  | "weekly_plan_tasks"
  | "weekly_active_days";

export interface QuestDef {
  id: string;
  category: QuestCategory;
  period: QuestPeriod;
  type: QuestType;
  action: QuestAction;
  rewardUnit: QuestRewardUnit;
  priority: number;
  progressTarget?: number;
  /** Config key resolving the target at runtime (admin-tunable); overrides `progressTarget`. */
  targetConfigKey?: string;
  progressSource?: QuestProgressSource;
}

export const QUEST_PERIOD_ONCE = "once";

const streakMilestoneQuest = (days: number, index: number): QuestDef => ({
  id: `milestone.streak.${days}`,
  category: "milestone",
  period: "once",
  type: QuestType.MILESTONE,
  action: "panel",
  rewardUnit: "XP",
  priority: 60 + index,
  progressTarget: days,
  progressSource: "streak",
});

const focusSessionMilestoneQuest = (count: number, index: number): QuestDef => ({
  id: `milestone.focus_sessions.${count}`,
  category: "milestone",
  period: "once",
  type: QuestType.MILESTONE,
  action: "study-session",
  rewardUnit: "XP",
  priority: 70 + index,
  progressTarget: count,
  progressSource: "completed_focus_sessions",
});

const planTaskMilestoneQuest = (count: number, index: number): QuestDef => ({
  id: `milestone.plan_tasks.${count}`,
  category: "milestone",
  period: "once",
  type: QuestType.MILESTONE,
  action: "plan",
  rewardUnit: "XP",
  priority: 80 + index,
  progressTarget: count,
  progressSource: "completed_plan_tasks",
});

export const QUEST_CATALOG: readonly QuestDef[] = [
  {
    id: "daily.plan-task-done",
    category: "daily_ritual",
    period: "daily",
    type: QuestType.DAILY_RITUAL,
    action: "plan",
    rewardUnit: "XP",
    priority: 10,
  },
  {
    id: "daily.focus-session-completed",
    category: "daily_ritual",
    period: "daily",
    type: QuestType.DAILY_RITUAL,
    action: "study-session",
    rewardUnit: "XP",
    priority: 20,
  },
  {
    /** Hidden from views (and never granted) while the user has no goal set. */
    id: "daily.focus-goal-met",
    category: "daily_ritual",
    period: "daily",
    type: QuestType.DAILY_RITUAL,
    action: "study-session",
    rewardUnit: "XP",
    priority: 25,
  },
  {
    id: "daily.mood-checkin",
    category: "daily_ritual",
    period: "daily",
    type: QuestType.DAILY_RITUAL,
    action: "mood-checkin",
    rewardUnit: "XP",
    priority: 30,
  },
  {
    /**
     * The ONLY recurring coin faucet — without it the economy is a one-shot trial (onboarding
     * coin is lifetime-capped at ~30 for a free user) and the "earned AI right" ends in a silent
     * wall. Roadmap §3 says "no coin for mere activity"; its stated reason (§2/§3) is that coin in
     * SOCIAL zones inflates the economy and corrupts the environment. An active day (≥1 completed
     * focus session OR ≥1 done plan task) is private, verified effort — not social, not farmable
     * without actually studying 5 separate days. Reward + target are config-tunable and the quest
     * is killable via `economy.quest.disabled_ids`.
     */
    id: "weekly.effort-allowance",
    category: "weekly_ritual",
    period: "weekly",
    type: QuestType.WEEKLY_RITUAL,
    action: "panel",
    rewardUnit: "COIN",
    priority: 35,
    targetConfigKey: "economy.quest.weekly_allowance_active_days_target",
    progressSource: "weekly_active_days",
  },
  {
    id: "weekly.focus-sessions",
    category: "weekly_ritual",
    period: "weekly",
    type: QuestType.WEEKLY_RITUAL,
    action: "study-session",
    rewardUnit: "XP",
    priority: 40,
    targetConfigKey: "economy.quest.weekly_focus_sessions_target",
    progressSource: "weekly_focus_sessions",
  },
  {
    id: "weekly.plan-tasks",
    category: "weekly_ritual",
    period: "weekly",
    type: QuestType.WEEKLY_RITUAL,
    action: "plan",
    rewardUnit: "XP",
    priority: 45,
    targetConfigKey: "economy.quest.weekly_plan_tasks_target",
    progressSource: "weekly_plan_tasks",
  },
  {
    /** Only completable on the week's last day by design (7/7 active days). */
    id: "weekly.streak-full-week",
    category: "weekly_ritual",
    period: "weekly",
    type: QuestType.WEEKLY_RITUAL,
    action: "panel",
    rewardUnit: "XP",
    priority: 48,
    progressTarget: 7,
    progressSource: "weekly_active_days",
  },
  ...STREAK_MILESTONES.map(streakMilestoneQuest),
  ...[10, 25, 50, 100].map(focusSessionMilestoneQuest),
  ...[25, 50, 100, 250].map(planTaskMilestoneQuest),
  {
    id: "onboarding.profile-setup",
    category: "onboarding",
    period: "once",
    type: QuestType.ONBOARDING,
    action: null,
    rewardUnit: "COIN",
    priority: 110,
  },
  {
    id: "onboarding.email-verified",
    category: "onboarding",
    period: "once",
    type: QuestType.ONBOARDING,
    action: "verify-email",
    rewardUnit: "COIN",
    priority: 120,
  },
  {
    id: "onboarding.first-subscription",
    category: "onboarding",
    period: "once",
    type: QuestType.ONBOARDING,
    action: "subscription",
    rewardUnit: "COIN",
    priority: 130,
  },
  {
    id: "onboarding.invite-redeemed",
    category: "onboarding",
    period: "once",
    type: QuestType.ONBOARDING,
    action: "invite",
    rewardUnit: "COIN",
    priority: 140,
  },
];
