/** Payments domain constants (W4). Statuses mirror @mentor/types SubscriptionStatus. */

export const TxType = {
  TRIAL_START: "TRIAL_START",
  RENEWAL: "RENEWAL",
  REFUND: "REFUND",
} as const;
export type TxType = (typeof TxType)[keyof typeof TxType];

export const TxStatus = {
  SUCCEEDED: "SUCCEEDED",
  FAILED: "FAILED",
  REFUNDED: "REFUNDED",
} as const;
export type TxStatus = (typeof TxStatus)[keyof typeof TxStatus];

/**
 * Dunning grace (§7): after a failed renewal the user keeps premium for this many days
 * (PAST_DUE). Invariant policy constant for MVP; moves to the config registry with W6.
 */
export const GRACE_PERIOD_DAYS = 3;
