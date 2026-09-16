import { Injectable } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { ConfigRegistryService } from "../../../common/config/config-registry.service";
import { PaymentsEventTopic, PaymentSucceeded } from "../../payments/domain/payments.events";
import { InviteService } from "./invite.service";

/**
 * Bridges payments → economy: on the invited user's first positive successful payment, reward the inviter
 * (forward-only, idempotent). Gated by `economy.enabled` (F5). Payment events are delivered through the transactional job queue.
 */
@Injectable()
export class InviteEventsListener {
  constructor(
    private readonly invites: InviteService,
    private readonly config: ConfigRegistryService,
  ) {}

  @OnEvent(PaymentsEventTopic.PAYMENT_SUCCEEDED, { suppressErrors: false })
  async onPaymentSucceeded(event: PaymentSucceeded): Promise<void> {
    if (!(await this.config.get("economy.enabled"))) return;
    await this.invites.onInvitedConverted(event);
  }
}
