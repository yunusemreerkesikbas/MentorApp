import { Injectable, Logger } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { IdentityEventTopic } from "../../identity/domain/identity.events";
import {
  PaymentsEventTopic,
  type SubscriptionActivated,
  type SubscriptionCanceled,
  type SubscriptionExpired,
} from "../../payments/domain/payments.events";
import { MentorshipLinkService } from "./mentorship-link.service";

/**
 * Payments → W8 seats. A subscription that starts, is cancelled by the provider or runs out can
 * move seats: the coach's plan sets how many paid seats there are, and a student's own
 * subscription decides whether they hold one at all (one payer per student). A cancel by the user
 * keeps access to the period end, so its reseat changes nothing until the sweeper's EXPIRED.
 *
 * Identity verification also retries unchanged seats: verified phones unlock funding, not seating.
 * Only public event constants cross the boundary; payments never learns what a seat is.
 * Best-effort, like every listener on these events: the payment already committed, and a reseat
 * that fails here is redone the next time the coach opens their home.
 */
@Injectable()
export class SeatEventsListener {
  private readonly logger = new Logger(SeatEventsListener.name);

  constructor(private readonly links: MentorshipLinkService) {}

  @OnEvent(PaymentsEventTopic.SUBSCRIPTION_ACTIVATED)
  onActivated(event: SubscriptionActivated): Promise<void> {
    return this.reseat(event.userId);
  }

  @OnEvent(PaymentsEventTopic.SUBSCRIPTION_CANCELED)
  onCanceled(event: SubscriptionCanceled): Promise<void> {
    return this.reseat(event.userId);
  }

  @OnEvent(PaymentsEventTopic.SUBSCRIPTION_EXPIRED)
  onExpired(event: SubscriptionExpired): Promise<void> {
    return this.reseat(event.userId);
  }

  @OnEvent(IdentityEventTopic.PHONE_VERIFIED)
  onPhoneVerified(event: { userId: string }): Promise<void> {
    return this.reseat(event.userId);
  }

  @OnEvent(IdentityEventTopic.EMAIL_VERIFIED)
  onEmailVerified(event: { userId: string }): Promise<void> {
    return this.reseat(event.userId);
  }

  private async reseat(userId: string): Promise<void> {
    await this.links.reseatForUser(userId).catch((err: unknown) => {
      this.logger.error(`Reseat after an eligibility change failed for user ${userId}`, err);
    });
  }
}
