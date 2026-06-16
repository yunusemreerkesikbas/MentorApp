/**
 * Static onboarding quest catalog (§3 light economy). The single source of truth for quest
 * definitions; per-user completion lives in `user_quest_progress`, the reward amount in the config
 * registry (`economy.quest.onboarding_reward_coin`). Habit/milestone tiers are backlog (need
 * coaching signals). Quest ids are STABLE — they key the ledger refType/reason and progress rows.
 */
export const QuestType = {
  ONBOARDING: "onboarding",
} as const;
export type QuestType = (typeof QuestType)[keyof typeof QuestType];

export interface QuestDef {
  id: string;
  type: QuestType;
  title: string;
}

export const QUEST_CATALOG = [
  { id: "onboarding.profile-setup", type: "onboarding", title: "Profilini tamamla (sınav seç)" },
  { id: "onboarding.email-verified", type: "onboarding", title: "E-posta adresini doğrula" },
  { id: "onboarding.first-subscription", type: "onboarding", title: "İlk aboneliğini başlat" },
  { id: "onboarding.invite-redeemed", type: "onboarding", title: "Bir davet kodu kullan" },
] as const satisfies readonly QuestDef[];
