import { Injectable } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { ConfigRegistryService } from "../../../common/config/config-registry.service";
import { PaymentsEventTopic, SubscriptionActivated } from "../../payments/domain/payments.events";
import { InviteService } from "./invite.service";

/**
 * Bridges payments → economy: when an invited user's subscription activates, reward the inviter
 * (forward-only, idempotent). Gated by `economy.enabled` (F5). Consumes the existing payments event
 * — no change to payments/identity.
 */
@Injectable()
export class InviteEventsListener {
  constructor(
    private readonly invites: InviteService,
    private readonly config: ConfigRegistryService,
  ) {}

  @OnEvent(PaymentsEventTopic.SUBSCRIPTION_ACTIVATED)
  async onSubscriptionActivated(event: SubscriptionActivated): Promise<void> {
    if (!(await this.config.get("economy.enabled"))) return;
    await this.invites.onInvitedConverted(event.userId);
  }
}
