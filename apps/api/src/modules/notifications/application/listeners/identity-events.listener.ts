import { Injectable, Logger } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import {
  IdentityEventTopic,
  type BuddyEvent,
  type UserFollowed,
} from "../../../identity/domain/identity.events";
import { NotificationCopyKey } from "../../domain/notification-copy";
import { NotificationsService } from "../notifications.service";

/**
 * Consumes identity domain events → in-app notifications. Best-effort: a failed notification never
 * breaks the emitter. The actor's display fields ride on the event payload, so this listener holds no
 * identity dependency (only the event contract). Reuses the FORUM category — the follow links into the
 * /community social surface (no new category churn, per plan).
 */
@Injectable()
export class IdentityEventsListener {
  private readonly logger = new Logger(IdentityEventsListener.name);

  constructor(private readonly notifications: NotificationsService) {}

  @OnEvent(IdentityEventTopic.USER_FOLLOWED)
  async onUserFollowed(e: UserFollowed): Promise<void> {
    if (e.recipientId === e.actorId) return; // can't follow yourself, but stay safe
    // A follower without a handle has no linkable profile page → notify without a link.
    const link = e.actorUsername ? `/community/member/${e.actorUsername}` : undefined;
    await this.notifications
      .createFromTemplate(e.recipientId, "FORUM", NotificationCopyKey.NEW_FOLLOWER, link, {
        args: { name: e.actorDisplayName },
      })
      .catch((err: unknown) =>
        this.logger.warn(`follow notification failed for ${e.recipientId}: ${String(err)}`),
      );
  }

  // Buddy notifications land on /study-session — the buddy card there handles accept/nudge-back.

  @OnEvent(IdentityEventTopic.BUDDY_REQUESTED)
  async onBuddyRequested(e: BuddyEvent): Promise<void> {
    await this.createBuddyNotification(e, NotificationCopyKey.BUDDY_REQUESTED);
  }

  @OnEvent(IdentityEventTopic.BUDDY_ACCEPTED)
  async onBuddyAccepted(e: BuddyEvent): Promise<void> {
    await this.createBuddyNotification(e, NotificationCopyKey.BUDDY_ACCEPTED);
  }

  @OnEvent(IdentityEventTopic.BUDDY_NUDGED)
  async onBuddyNudged(e: BuddyEvent): Promise<void> {
    await this.createBuddyNotification(e, NotificationCopyKey.BUDDY_NUDGED);
  }

  private async createBuddyNotification(e: BuddyEvent, templateKey: NotificationCopyKey): Promise<void> {
    if (e.recipientId === e.actorId) return;
    await this.notifications
      .createFromTemplate(e.recipientId, "FORUM", templateKey, "/study-session", {
        args: { name: e.actorDisplayName },
      })
      .catch((err: unknown) =>
        this.logger.warn(`buddy notification failed for ${e.recipientId}: ${String(err)}`),
      );
  }
}
