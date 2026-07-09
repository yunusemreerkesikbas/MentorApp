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
 */
export const QuestType = {
  ONBOARDING: "onboarding",
  DAILY_RITUAL: "daily_ritual",
  MILESTONE: "milestone",
} as const;
export type QuestType = (typeof QuestType)[keyof typeof QuestType];
export type QuestProgressSource =
  | "streak"
  | "completed_focus_sessions"
  | "completed_plan_tasks";

export interface QuestDef {
  id: string;
  category: QuestCategory;
  period: QuestPeriod;
  type: QuestType;
  title: string;
  badgeLabel: string;
  action: QuestAction;
  rewardUnit: QuestRewardUnit;
  priority: number;
  progressTarget?: number;
  progressSource?: QuestProgressSource;
}

export const QUEST_PERIOD_ONCE = "once";

const streakMilestoneQuest = (days: number, index: number): QuestDef => ({
  id: `milestone.streak.${days}`,
  category: "milestone",
  period: "once",
  type: QuestType.MILESTONE,
  title: `${days} günlük ritme ulaş`,
  badgeLabel: "Kilometre",
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
  title: `${count} odak seansı tamamla`,
  badgeLabel: "Odak",
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
  title: `${count} plan görevi tamamla`,
  badgeLabel: "Plan",
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
    title: "Bugünün planından 1 görev tamamla",
    badgeLabel: "Ritim",
    action: "plan",
    rewardUnit: "XP",
    priority: 10,
  },
  {
    id: "daily.focus-session-completed",
    category: "daily_ritual",
    period: "daily",
    type: QuestType.DAILY_RITUAL,
    title: "1 odak seansı bitir",
    badgeLabel: "Odak",
    action: "study-session",
    rewardUnit: "XP",
    priority: 20,
  },
  {
    id: "daily.mood-checkin",
    category: "daily_ritual",
    period: "daily",
    type: QuestType.DAILY_RITUAL,
    title: "Bugünkü ruh halini işaretle",
    badgeLabel: "Duygu",
    action: "mood-checkin",
    rewardUnit: "XP",
    priority: 30,
  },
  ...STREAK_MILESTONES.map(streakMilestoneQuest),
  ...[10, 25, 50, 100].map(focusSessionMilestoneQuest),
  ...[25, 50, 100, 250].map(planTaskMilestoneQuest),
  {
    id: "onboarding.profile-setup",
    category: "onboarding",
    period: "once",
    type: QuestType.ONBOARDING,
    title: "Profilini tamamla (sınav seç)",
    badgeLabel: "Başlangıç",
    action: null,
    rewardUnit: "COIN",
    priority: 110,
  },
  {
    id: "onboarding.email-verified",
    category: "onboarding",
    period: "once",
    type: QuestType.ONBOARDING,
    title: "E-posta adresini doğrula",
    badgeLabel: "Başlangıç",
    action: "verify-email",
    rewardUnit: "COIN",
    priority: 120,
  },
  {
    id: "onboarding.first-subscription",
    category: "onboarding",
    period: "once",
    type: QuestType.ONBOARDING,
    title: "İlk aboneliğini başlat",
    badgeLabel: "Başlangıç",
    action: "subscription",
    rewardUnit: "COIN",
    priority: 130,
  },
  {
    id: "onboarding.invite-redeemed",
    category: "onboarding",
    period: "once",
    type: QuestType.ONBOARDING,
    title: "Bir davet kodu kullan",
    badgeLabel: "Başlangıç",
    action: "invite",
    rewardUnit: "COIN",
    priority: 140,
  },
];
