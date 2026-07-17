import { Injectable, Logger } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import {
  IdentityEventTopic,
  type BuddyEvent,
  type UserFollowed,
} from "../../../identity/domain/identity.events";
import { NotificationsService } from "../notifications.service";

/**
 * Consumes identity domain events → in-app notifications. Best-effort: a failed notification never
 * breaks the emitter. The actor's display fields ride on the event payload, so this listener holds no
 * identity dependency (only the event contract). Reuses the FORUM category — the follow links into the
 * /topluluk social surface (no new category churn, per plan).
 */
@Injectable()
export class IdentityEventsListener {
  private readonly logger = new Logger(IdentityEventsListener.name);

  constructor(private readonly notifications: NotificationsService) {}

  @OnEvent(IdentityEventTopic.USER_FOLLOWED)
  async onUserFollowed(e: UserFollowed): Promise<void> {
    if (e.recipientId === e.actorId) return; // can't follow yourself, but stay safe
    // A follower without a handle has no linkable profile page → notify without a link.
    const link = e.actorUsername ? `/topluluk/uye/${e.actorUsername}` : undefined;
    await this.notifications
      .createInApp(e.recipientId, "FORUM", "Yeni takipçi", `${e.actorDisplayName} seni takip etti.`, link)
      .catch((err: unknown) =>
        this.logger.warn(`follow notification failed for ${e.recipientId}: ${String(err)}`),
      );
  }

  // Buddy notifications land on /seans — the buddy card there handles accept/nudge-back.

  @OnEvent(IdentityEventTopic.BUDDY_REQUESTED)
  async onBuddyRequested(e: BuddyEvent): Promise<void> {
    await this.createBuddyNotification(
      e,
      "Yol arkadaşı daveti",
      `${e.actorDisplayName} seni yol arkadaşı olmak için davet etti.`,
    );
  }

  @OnEvent(IdentityEventTopic.BUDDY_ACCEPTED)
  async onBuddyAccepted(e: BuddyEvent): Promise<void> {
    await this.createBuddyNotification(
      e,
      "Davetin kabul edildi",
      `${e.actorDisplayName} davetini kabul etti — artık yol arkadaşısınız.`,
    );
  }

  @OnEvent(IdentityEventTopic.BUDDY_NUDGED)
  async onBuddyNudged(e: BuddyEvent): Promise<void> {
    await this.createBuddyNotification(
      e,
      "Yol arkadaşından dürtme",
      `${e.actorDisplayName} seni dürttü — bugün bir seansa var mısın?`,
    );
  }

  private async createBuddyNotification(
    e: BuddyEvent,
    title: string,
    body: string,
  ): Promise<void> {
    if (e.recipientId === e.actorId) return;
    await this.notifications
      .createInApp(e.recipientId, "FORUM", title, body, "/seans")
      .catch((err: unknown) =>
        this.logger.warn(`buddy notification failed for ${e.recipientId}: ${String(err)}`),
      );
  }
}
