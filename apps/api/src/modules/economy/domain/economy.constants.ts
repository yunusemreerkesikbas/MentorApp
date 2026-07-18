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
} as const;
