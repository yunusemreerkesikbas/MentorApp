/** Economy module contracts (W6) — shared by api (producer) and web/mobile (consumers). */

/** GET /v1/economy/balance — sum of ledger rows (never a single stored number). */
export interface EconomyBalance {
  xp: number;
  coinConfirmed: number;
  coinPending: number;
}

export type QuestCategory = "daily_ritual" | "onboarding";
export type QuestPeriod = "daily" | "once";
export type QuestRewardUnit = "XP" | "COIN" | "NONE";
export type QuestAction =
  | "plan"
  | "study-session"
  | "mood-checkin"
  | "subscription"
  | "invite"
  | "verify-email"
  | null;

/** GET /v1/economy/quests — quest catalog + progress (backend titles, localized). */
export interface QuestProgressView {
  id: string;
  category: QuestCategory;
  period: QuestPeriod;
  periodKey: string;
  type: string;
  title: string;
  badgeLabel: string;
  action: QuestAction;
  rewardUnit: QuestRewardUnit;
  rewardAmount: number;
  /** Backward-compatible field for older clients. 0 for non-Coin rewards. */
  rewardCoin: number;
  completed: boolean;
  completedAt: string | null;
}

/** GET /v1/economy/invite — stable invite code for the user. */
export interface InviteCodeView {
  code: string;
}

/** POST /v1/economy/invite/redeem — redemption accepted (reward is async on conversion). */
export interface RedeemInviteResult {
  status: string;
}
