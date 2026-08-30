import { HttpStatus, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { DomainError } from "../../../../common/errors/domain-error";
import { ErrorCode } from "../../../../common/errors/error-code";
import type { Env } from "../../../../config/env.validation";
import type {
  CheckoutRequest,
  CheckoutResult,
  PaymentsPort,
  ProviderEvent,
  RefundResult,
} from "../../../../shared/ports/payments.port";

/**
 * iyzico Subscription API adapter — ⚠️ UNVERIFIED SKELETON.
 *
 * Written against the public API docs (subscription checkout-form initialize / cancel /
 * webhooks); it CANNOT be exercised until Phase-0 paperwork yields sandbox credentials
 * (roadmap §7/§12). Selected via PAYMENTS_PROVIDER=iyzico (env lock requires the keys).
 * Until verified, every call fails loudly rather than pretending to work.
 */
@Injectable()
export class IyzicoPaymentsAdapter implements PaymentsPort {
  readonly provider = "IYZICO" as const;
  // Real iyzico uses a hosted payment page — the row stays INCOMPLETE until the
  // checkout_completed webhook confirms payment (verification gate).
  readonly instantCheckout = false;
  private readonly logger = new Logger(IyzicoPaymentsAdapter.name);

  constructor(private readonly config: ConfigService<Env, true>) {}

  async createCheckout(req: CheckoutRequest): Promise<CheckoutResult> {
    // Planned call: POST {IYZICO_BASE_URL}/v2/subscription/checkoutform/initialize
    //   { pricingPlanReferenceCode, customer{email}, callbackUrl: req.returnUrl }
    // → { checkoutFormContent | paymentPageUrl, referenceCode }
    //
    // ⚠️ OPEN DECISION for whoever implements this: the Subscription API bills whatever the
    // `pricingPlanReferenceCode` says, so it has no natural slot for a per-checkout
    // `chargeAmountMinor`. Either (a) mint/reuse an iyzico pricing plan per discounted price and
    // move the subscriber to the list plan after `discountPeriods`, or (b) drive the first charge
    // through the one-off checkout form (which does carry basketItems) and subscribe afterwards.
    // Until one is built, honouring a discount is impossible — so this must keep FAILING rather
    // than quietly charging `priceMinor` after the user agreed to `chargeAmountMinor`.
    this.notVerified("createCheckout", {
      planId: req.plan.id,
      chargeAmountMinor: req.plan.chargeAmountMinor,
      discountPeriods: req.plan.discountPeriods,
    });
  }

  async cancel(providerRef: string): Promise<void> {
    // Planned call: POST /v2/subscription/subscriptions/{providerRef}/cancel
    this.notVerified("cancel", { providerRef });
  }

  async refund(providerRef: string, amountMinor: number, idempotencyKey: string): Promise<RefundResult> {
    // Planned call: POST {IYZICO_BASE_URL}/v2/payment/refund
    //   { paymentTransactionId, price, currency }, header Idempotency-Key: idempotencyKey
    this.notVerified("refund", { providerRef, amountMinor, idempotencyKey });
  }

  verifyWebhook(
    _rawBody: Buffer,
    _headers: Record<string, string | string[] | undefined>,
  ): ProviderEvent {
    // Planned: validate the iyzico signature header (HMAC-SHA1 of eventType+iyziEventTime+token
    // per docs), then map iyziEventType → ProviderEventType:
    //   subscription.order.success → payment_succeeded · subscription.order.failure → payment_failed
    //   subscription.canceled → subscription_canceled
    this.notVerified("verifyWebhook");
  }

  private notVerified(method: string, ctx?: Record<string, unknown>): never {
    this.logger.error(`IyzicoPaymentsAdapter.${method} called but the adapter is UNVERIFIED ${JSON.stringify(ctx ?? {})}`);
    throw new DomainError(ErrorCode.PAYMENT_PROVIDER_ERROR, HttpStatus.SERVICE_UNAVAILABLE);
  }
}
