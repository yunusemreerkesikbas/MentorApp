/**
 * Payments domain events (§8 event backbone) — emitted via EventEmitter2.
 * Consumers: notifications (W5: dunning/renewal mails), economy (W6), analytics.
 * Topic strings follow the `module.entity.action` convention (code-style §4).
 */

export const PaymentsEventTopic = {
  SUBSCRIPTION_ACTIVATED: "payments.subscription.activated",
  SUBSCRIPTION_CANCELED: "payments.subscription.canceled",
  PAYMENT_FAILED: "payments.payment.failed",
  PAYMENT_REFUNDED: "payments.payment.refunded",
  /** Access actually ended (sweeper). Distinct from CANCELED, which still has paid time left. */
  SUBSCRIPTION_EXPIRED: "payments.subscription.expired",
} as const;

export class SubscriptionActivated {
  constructor(
    readonly userId: string,
    readonly subscriptionId: string,
    readonly planId: string,
  ) {}
}

export class SubscriptionCanceled {
  constructor(
    readonly userId: string,
    readonly subscriptionId: string,
    /** true = user-initiated (period-end), false = provider/dunning end. */
    readonly byUser: boolean,
  ) {}
}

export class PaymentFailed {
  constructor(
    readonly userId: string,
    readonly subscriptionId: string,
    readonly graceUntil: Date,
  ) {}
}

export class PaymentRefunded {
  constructor(
    readonly userId: string,
    readonly subscriptionId: string,
    readonly amountMinor: number,
  ) {}
}

export class SubscriptionExpired {
  constructor(
    readonly userId: string,
    readonly subscriptionId: string,
    readonly planId: string,
  ) {}
}
