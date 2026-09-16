import { Injectable } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { PaymentsEventTopic, PaymentRefunded } from "../../payments/domain/payments.events";
import { InviteService } from "./invite.service";

/**
 * Bridges payments → economy: a refund of the invited user's charge reverses the inviter's
 * conversion reward (refund-only + clamp-to-zero, §3). Not gated by `economy.enabled` — a
 * compensating ledger write must still run if the grant already landed (kill-switch / dormant flag).
 */
@Injectable()
export class RefundEventsListener {
  constructor(private readonly invites: InviteService) {}

  @OnEvent(PaymentsEventTopic.PAYMENT_REFUNDED, { suppressErrors: false })
  onPaymentRefunded(event: PaymentRefunded): Promise<void> {
    return this.invites.onInvitedRefunded(event.userId, event.sourcePaymentId);
  }
}
