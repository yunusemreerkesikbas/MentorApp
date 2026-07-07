import type {
  QuestAction,
  QuestCategory,
  QuestPeriod,
  QuestRewardUnit,
} from "@mentor/types";

/**
 * Static quest catalog (§3 light economy). The single source of truth for quest definitions;
 * per-user completion lives in `user_quest_progress`, reward amounts come from the config registry.
 * Quest ids are STABLE — they key the ledger refType/reason and progress rows.
 */
export const QuestType = {
  ONBOARDING: "onboarding",
  DAILY_RITUAL: "daily_ritual",
} as const;
export type QuestType = (typeof QuestType)[keyof typeof QuestType];

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
}

export const QUEST_PERIOD_ONCE = "once";

export const QUEST_CATALOG = [
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
] as const satisfies readonly QuestDef[];
