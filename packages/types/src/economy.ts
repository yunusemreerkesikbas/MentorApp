/** Economy module contracts (W6) — shared by api (producer) and web/mobile (consumers). */

import type { CommunityLevelView } from "./community.js";

/** GET /v1/economy/balance — sum of ledger rows (never a single stored number). */
export interface EconomyBalance {
  xp: number;
  coinConfirmed: number;
  coinPending: number;
  /** XP tier derived from the shared curve (@mentor/core) — gives the bare XP number meaning. */
  level: CommunityLevelView;
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

/** GET /v1/economy/invite — stable invite code for the user. */
export interface InviteCodeView {
  code: string;
}

/** POST /v1/economy/invite/redeem — redemption accepted (reward is async on conversion). */
export interface RedeemInviteResult {
  status: string;
}
