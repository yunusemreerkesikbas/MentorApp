/**
 * Payments port (§7 Ports & Adapters) — provider behind DI: FakePaymentsAdapter (dev/test)
 * or IyzicoPaymentsAdapter (production; Phase-0 paperwork pending).
 *
 * Card data is NOT ours (provider-hosted/tokenized — PCI stays with the provider).
 * Renewal charging is provider-side → our system reacts to webhooks only.
 */

export const PAYMENTS_PORT = Symbol("PAYMENTS_PORT");

export type ProviderEventType =
  /** Provider confirmed the checkout — activates an INCOMPLETE row (verification gate). */
  | "checkout_completed"
  | "trial_started"
  | "payment_succeeded"
  | "payment_failed"
  | "subscription_canceled";

/** Normalized provider webhook event (adapter parses provider-specific payloads into this). */
export interface ProviderEvent {
  /** Provider-unique event id — the idempotency key. */
  eventId: string;
  type: ProviderEventType;
  /** Our subscription reference at the provider. */
  providerRef: string;
  /** Charge amount in minor units (kuruş) — present on payment events. */
  amountMinor?: number;
  occurredAt: string; // ISO
}

export interface CheckoutRequest {
  userId: string;
  userEmail: string;
  plan: {
    id: string;
    priceMinor: number;
    currency: string;
    periodMonths: number;
    trialDays: number;
  };
  /** Where the provider sends the customer after checkout. */
  returnUrl: string;
}

export interface CheckoutResult {
  /** Provider-hosted payment page (fake: internal success URL). */
  checkoutUrl: string;
  /** Reference to the created provider-side subscription. */
  providerRef: string;
}

export interface RefundResult {
  /** Provider-side refund reference (fake: synthetic; iyzico: provider refund id). */
  refundRef: string;
}

export interface PaymentsPort {
  /** Which provider this adapter represents (stored on the subscription row). */
  readonly provider: "FAKE" | "IYZICO";

  /**
   * Whether checkout completes instantly (no external payment page). FAKE=true → the subscription
   * is granted its status at checkout-init. IYZICO=false → checkout-init creates an INCOMPLETE row
   * that only the provider's `checkout_completed` webhook may activate (verification gate — an
   * abandoned payment page must not grant premium).
   */
  readonly instantCheckout: boolean;

  /** Start a carded-trial subscription checkout (§7: explicit consent handled by FE copy). */
  createCheckout(req: CheckoutRequest): Promise<CheckoutResult>;

  /** Stop renewals provider-side (access until period end is OUR state machine's job). */
  cancel(providerRef: string): Promise<void>;

  /**
   * Refund a charge provider-side. `idempotencyKey` dedupes retries at the provider.
   * MUST be called before appending the ledger row so a provider failure aborts the record.
   */
  refund(providerRef: string, amountMinor: number, idempotencyKey: string): Promise<RefundResult>;

  /**
   * Verify the webhook signature and parse the payload into a normalized event.
   * MUST throw on an invalid signature (never process unverified payloads).
   */
  verifyWebhook(rawBody: Buffer, headers: Record<string, string | string[] | undefined>): ProviderEvent;
}
