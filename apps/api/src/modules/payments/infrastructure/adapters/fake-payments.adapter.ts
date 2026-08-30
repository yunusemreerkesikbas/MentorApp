import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { HttpStatus, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { DomainError } from "../../../../common/errors/domain-error";
import { ErrorCode } from "../../../../common/errors/error-code";
import type { Env } from "../../../../config/env.validation";
import type {
  CheckoutRequest,
  CheckoutResult,
  PaymentsPort,
  ProviderEvent,
  ProviderEventType,
  RefundResult,
} from "../../../../shared/ports/payments.port";

/**
 * Deterministic dev/test provider — NO external account needed.
 *
 * - `createCheckout`: no real charge; returns an internal success URL so the FE flow
 *   is fully clickable end-to-end. The subscription starts as TRIALING immediately.
 * - Webhooks: lifecycle events (renewal success/failure, cancel) are SIMULATED by
 *   posting HMAC-signed payloads to /v1/webhooks/payments — `signFakeWebhook` builds
 *   them (used by tests and local curl).
 * - Production: forbidden — env validation fails the boot (see env.validation.ts).
 */
@Injectable()
export class FakePaymentsAdapter implements PaymentsPort {
  readonly provider = "FAKE" as const;
  // Fake checkout completes instantly → the row is granted its status at checkout-init (no
  // verification gate); real iyzico sets this false so an INCOMPLETE row waits for the webhook.
  readonly instantCheckout = true;

  constructor(private readonly config: ConfigService<Env, true>) {}

  async createCheckout(req: CheckoutRequest): Promise<CheckoutResult> {
    const providerRef = `fake_${randomUUID()}`;
    // The "payment page" is simply the return URL with a success flag. The amount is echoed so a
    // local/e2e run can sign a renewal webhook with the SAME figure the discount produced.
    const url = new URL(req.returnUrl);
    url.searchParams.set("status", "success");
    url.searchParams.set("ref", providerRef);
    url.searchParams.set("amount", String(req.plan.chargeAmountMinor));
    return { checkoutUrl: url.toString(), providerRef };
  }

  async cancel(_providerRef: string): Promise<void> {
    // Nothing to do provider-side for the fake provider.
  }

  async refund(providerRef: string, _amountMinor: number, idempotencyKey: string): Promise<RefundResult> {
    // No real money movement — return a deterministic ref derived from the idempotency key so a
    // retry with the same key yields the same ref (mirrors provider idempotency semantics).
    return { refundRef: `fake_refund_${idempotencyKey}` };
  }

  verifyWebhook(
    rawBody: Buffer,
    headers: Record<string, string | string[] | undefined>,
  ): ProviderEvent {
    const given = headers["x-fake-signature"];
    const signature = Array.isArray(given) ? given[0] : given;
    // Guaranteed present by the env lock when PAYMENTS_PROVIDER=fake (this adapter's only mode).
    const secret = this.config.get("PAYMENTS_WEBHOOK_SECRET", { infer: true });
    if (!secret) throw new DomainError(ErrorCode.PAYMENT_WEBHOOK_INVALID, HttpStatus.INTERNAL_SERVER_ERROR);
    const expected = createHmac("sha256", secret).update(rawBody).digest("hex");

    if (
      !signature ||
      signature.length !== expected.length ||
      !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
    ) {
      throw new DomainError(ErrorCode.PAYMENT_WEBHOOK_INVALID, HttpStatus.UNAUTHORIZED);
    }

    const parsed = JSON.parse(rawBody.toString()) as Partial<ProviderEvent>;
    if (!parsed.eventId || !parsed.type || !parsed.providerRef) {
      throw new DomainError(ErrorCode.PAYMENT_WEBHOOK_INVALID, HttpStatus.BAD_REQUEST);
    }
    return {
      eventId: parsed.eventId,
      type: parsed.type,
      providerRef: parsed.providerRef,
      amountMinor: parsed.amountMinor,
      occurredAt: parsed.occurredAt ?? new Date().toISOString(),
    };
  }
}

/** Test/dev helper: build a signed fake-webhook request body + headers. */
export function signFakeWebhook(
  secret: string,
  event: {
    eventId?: string;
    type: ProviderEventType;
    providerRef: string;
    amountMinor?: number;
  },
): { body: string; headers: Record<string, string> } {
  const body = JSON.stringify({
    eventId: event.eventId ?? `evt_${randomUUID()}`,
    type: event.type,
    providerRef: event.providerRef,
    amountMinor: event.amountMinor,
    occurredAt: new Date().toISOString(),
  });
  const signature = createHmac("sha256", secret).update(body).digest("hex");
  return { body, headers: { "x-fake-signature": signature, "content-type": "application/json" } };
}
