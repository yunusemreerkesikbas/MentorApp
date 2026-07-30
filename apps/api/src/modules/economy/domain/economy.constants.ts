/** Ledger reason / ref keys for economy spend flows (append-only, §4 #3). */
export const EconomyLedger = {
  AI_CHAT_SPEND_REASON: "ai.chat.spend",
  AI_CHAT_REFUND_REASON: "ai.chat.refund",
  AI_CHAT_REF_TYPE: "ai_chat",
  AI_CHAT_REFUND_REF_TYPE: "ai_chat_refund",
  STREAK_FREEZE_SPEND_REASON: "streak.freeze.purchase",
  STREAK_FREEZE_REFUND_REASON: "streak.freeze.refund",
  STREAK_FREEZE_REF_TYPE: "streak_freeze",
  STREAK_FREEZE_REFUND_REF_TYPE: "streak_freeze_refund",
  INVITE_CONVERTED_REASON: "invite.converted",
  INVITE_REF_TYPE: "invite-redemption",
  INVITE_REVERSAL_REASON: "invite.reverted",
  INVITE_REVERSAL_REF_TYPE: "invite_reversal",
  DEEP_ANALYSIS_SPEND_REASON: "analysis.deep.purchase",
  DEEP_ANALYSIS_REF_TYPE: "deep_analysis",
} as const;

/**
 * Compensating-refund reasons: corrections, NOT organic earnings. Excluded from `coinEarnedSince`
 * so a failed spend never eats the user's daily/weekly cap headroom. Add every new refund leg here.
 */
export const CORRECTION_REASONS = [
  EconomyLedger.AI_CHAT_REFUND_REASON,
  EconomyLedger.STREAK_FREEZE_REFUND_REASON,
] as const;
