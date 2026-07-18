import { Injectable } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { ConfigRegistryService } from "../../../common/config/config-registry.service";
import { PaymentsEventTopic, PaymentRefunded } from "../../payments/domain/payments.events";
import { InviteService } from "./invite.service";

/**
 * Bridges payments → economy: a refund of the invited user's charge reverses the inviter's
 * conversion reward (refund-only + clamp-to-zero, §3). Gated by `economy.enabled`.
 */
@Injectable()
export class RefundEventsListener {
  constructor(
    private readonly invites: InviteService,
    private readonly config: ConfigRegistryService,
  ) {}

  @OnEvent(PaymentsEventTopic.PAYMENT_REFUNDED)
  async onPaymentRefunded(event: PaymentRefunded): Promise<void> {
    if (!(await this.config.get("economy.enabled"))) return;
    await this.invites.onInvitedRefunded(event.userId);
  }
}
