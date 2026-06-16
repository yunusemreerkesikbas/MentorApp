import { Injectable } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { PaymentsEventTopic, SubscriptionActivated } from "../../payments/domain/payments.events";
import { QuestService } from "./quest.service";

/**
 * Bridges payments → economy quests: when a user's subscription activates, re-evaluate their
 * onboarding quests (grants the first-subscription quest, plus any other now-true). Idempotent;
 * `evaluateAndGrant` self-guards on `economy.enabled`. Consumes the existing payments event —
 * no change to payments/identity.
 */
@Injectable()
export class QuestEventsListener {
  constructor(private readonly quests: QuestService) {}

  @OnEvent(PaymentsEventTopic.SUBSCRIPTION_ACTIVATED)
  async onSubscriptionActivated(event: SubscriptionActivated): Promise<void> {
    await this.quests.evaluateAndGrant(event.userId);
  }
}
