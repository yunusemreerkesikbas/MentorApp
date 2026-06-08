/**
 * Payments port (§7 Ports & Adapters) — iyzico adapter behind it.
 *
 * Card data is NOT ours (iyzico hosted/tokenized). The webhook must be idempotent
 * (no double coin/subscription). Marketplace sub-merchant → Phase 3.
 */
export const PAYMENTS_PORT = Symbol("PAYMENTS_PORT");

export interface PaymentsPort {
  /** Start an auto-renewing subscription (carded trial → premium). */
  createSubscription(input: {
    userId: string;
    plan: string;
    cardToken: string;
  }): Promise<{ subscriptionRef: string }>;

  /** Self-serve cancel: renewal stops, access until end of the paid period. */
  cancelSubscription(subscriptionRef: string): Promise<void>;
}
