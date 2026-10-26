/** Economy module contracts (W6) — shared by api (producer) and web/mobile (consumers). */

import type { CommunityLevelView } from "./community.js";

/** GET /v1/economy/balance — sum of ledger rows (never a single stored number). */
export interface EconomyBalance {
  xp: number;
  coinConfirmed: number;
  coinPending: number;
  /** XP tier derived from the shared curve (@mentor/core) — gives the bare XP number meaning. */
  level: CommunityLevelView;
  /** Alternative uses of the current balance; eligibility/budget checks still apply at purchase. */
  usage?: { chatCost: number; analysisCost: number; chatMessages: number; weeklyAnalyses: number };
}

/** GET /v1/economy/ledger — append-only economy history, ready to render. */
export interface EconomyLedgerEntryView {
  id: string;
  unit: "XP" | "COIN";
  amount: number;
  reason: string;
  status: "PENDING" | "CONFIRMED" | "REVERSED";
  note: string | null;
  title: string;
  description: string;
  createdAt: string;
}

/**
 * GET/POST /v1/economy/streak-rescue — coin-purchased streak freeze for the single missed day the
 * streak derivation broke on. `canAfford` compares confirmed coin against `cost`; `date` is the
 * buyable day (yyyy-mm-dd).
 */
export interface StreakRescueView {
  eligible: boolean;
  date: string | null;
  cost: number;
  coinConfirmed: number;
  canAfford: boolean;
}

/** GET/POST /v1/economy/deep-analysis — weekly deep-analysis unlock state (coin sink). */
export interface DeepAnalysisView {
  /** The weekly review is READY — there is a report to unlock. */
  eligible: boolean;
  /** ISO start date of the review week; null when not eligible. */
  weekStart: string | null;
  cost: number;
  coinConfirmed: number;
  canAfford: boolean;
  /** Unlocked for this exam+week (purchased, or included via premium). */
  unlocked: boolean;
  premium: boolean;
}

export type QuestCategory = "daily_ritual" | "weekly_ritual" | "milestone" | "onboarding";
export type QuestPeriod = "daily" | "weekly" | "once";
export type QuestRewardUnit = "XP" | "COIN" | "NONE";
export type QuestAction =
  | "plan"
  | "study-session"
  | "mood-checkin"
  | "panel"
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
  progressCurrent?: number;
  progressTarget?: number;
  completed: boolean;
  completedAt: string | null;
}

/** One rolling window's total ledger flow. Coin credited/debited are both POSITIVE magnitudes. */
export interface EconomyFlowDto {
  coinCredited: number;
  coinDebited: number;
  xpCredited: number;
  rows: number;
}

/** Flow attributed to one ledger `reason` — the faucet/sink breakdown. */
export interface EconomyReasonFlowDto {
  reason: string;
  credited: number;
  debited: number;
  /** Distinct users this reason touched in the window. */
  users: number;
}

/**
 * GET /v1/admin/metrics/economy — coin/XP faucet + sink visibility, so earning rates can be
 * calibrated from live data (roadmap §729) instead of guessed. All windows roll from now.
 */
export interface AdminEconomyStatsDto {
  /** Rolling windows: last 24h / 7d / 30d. */
  windows: { d1: EconomyFlowDto; d7: EconomyFlowDto; d30: EconomyFlowDto };
  /** Per-reason COIN breakdown over 30d, biggest flow first. ORGANIC only (admin rows excluded). */
  coinByReason: EconomyReasonFlowDto[];
  /** Per-reason XP breakdown over 30d — the leaderboard-integrity signal. */
  xpByReason: EconomyReasonFlowDto[];
  /** Admin manual adjustments over 30d, kept out of the organic rates they would distort. */
  corrections: { credited: number; debited: number; rows: number };
  /** Unspent confirmed coin held across all users — the outstanding liability. */
  float: { coinConfirmed: number; holders: number };
  /** Recurring-faucet reach: who actually earns the weekly allowance, over the denominator. */
  faucetReach: { earners7d: number; activeUsers7d: number };
  generatedAt: string;
}

/**
 * The friend discount as the invited user is told about it. `phoneRequired` means "the discount is
 * waiting, verify your phone to get it": the INVITED promotion is keyed on a verified phone, so
 * without one checkout would charge the list price.
 */
export interface InviteDiscountView {
  discountType: "PERCENT" | "FIXED";
  /** The magnitude checkout really applies: percent for PERCENT, kuruş for FIXED. */
  discountValue: number;
  phoneRequired: boolean;
}

/**
 * GET /v1/economy/invite — the user's own invite card: code, progress as inviter, and (when this
 * user was invited by someone) their own invitation. Never exposes more than a display name per friend.
 */
export interface InviteCodeView {
  code: string;
  /** Coin the inviter earns when a friend's first real payment succeeds. */
  rewardCoin: number;
  /** Friends who joined with this code, newest first, at most 20. Display names only. */
  joined: { displayName: string }[];
  /**
   * Everyone who joined with this code, however many `joined` lists: a number only, so it also counts
   * friends who are no longer live accounts (erased or suspended) without naming them.
   */
  joinedCount: number;
  /** Friends who paid and whose payment still stands (refunded or reversed ones do not count). */
  convertedCount: number;
  /** Set when this user redeemed a friend's code. */
  redeemed: { inviterDisplayName: string; discount: InviteDiscountView | null } | null;
  /** False once redeemed, once paid, or when the signup window has closed (same rules as redeem). */
  canRedeem: boolean;
  /**
   * What a friend gets with this user's code right now (the live INVITED promotion, as the public
   * preview shows it), or null when none is live, the web sells no plan or the lookup failed.
   */
  friendDiscount: Omit<InviteDiscountView, "phoneRequired"> | null;
}

/**
 * GET /v1/economy/invite/preview/:code — public, what a friend sees before signing up. Only the
 * inviter's display name: no username, avatar or id. 404 `INVITE_CODE_INVALID` for any unusable code.
 */
export interface InvitePreviewView {
  inviterDisplayName: string;
  /** Null when no friend discount is live or the web cannot sell a plan. */
  discount: Omit<InviteDiscountView, "phoneRequired"> | null;
}

/** POST /v1/economy/invite/redeem — redemption accepted (reward is async on conversion). */
export interface RedeemInviteResult {
  status: string;
}
