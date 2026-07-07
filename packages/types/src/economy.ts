/** Economy module contracts (W6) — shared by api (producer) and web/mobile (consumers). */

/** GET /v1/economy/balance — sum of ledger rows (never a single stored number). */
export interface EconomyBalance {
  xp: number;
  coinConfirmed: number;
  coinPending: number;
}

/** GET /v1/economy/quests — onboarding quest progress (backend titles, localized). */
export interface QuestProgressView {
  id: string;
  type: string;
  title: string;
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
