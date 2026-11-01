import { Injectable } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import {
  PaymentsEventTopic,
  PaymentSucceeded,
} from "../../payments/domain/payments.events";
import { InviteService } from "./invite.service";

/**
 * Bridges payments → economy: on the invited user's first positive successful payment, reward the inviter
 * (forward-only, idempotent). The service settles disabled outcomes without Coin, so a later replay
 * cannot backpay a closed-period event. Payment events arrive through the transactional job queue.
 */
@Injectable()
export class InviteEventsListener {
  constructor(private readonly invites: InviteService) {}

  @OnEvent(PaymentsEventTopic.PAYMENT_SUCCEEDED, { suppressErrors: false })
  async onPaymentSucceeded(event: PaymentSucceeded): Promise<void> {
    await this.invites.onInvitedConverted(event);
  }
}
